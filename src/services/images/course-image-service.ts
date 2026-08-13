/**
 * Course image fetch + storage abstraction (M18.2).
 * Storage is mockable — no live Vercel Blob credentials required in CI.
 */

export type ImagePolicy = "STORE_COPY" | "REMOTE_ONLY" | "NO_EXTERNAL_IMAGE";

export type CourseImageMetadata = {
  sourceUrl: string | null;
  storageUrl: string | null;
  lastVerifiedAt: Date | null;
  policy: ImagePolicy;
};

export type ImageFetchResult =
  | { ok: true; contentType: string; bytes: Uint8Array; finalUrl: string }
  | { ok: false; reason: string };

export interface CourseImageStorage {
  store(params: {
    courseId: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<string | null>;
}

export class MemoryCourseImageStorage implements CourseImageStorage {
  private readonly files = new Map<string, string>();

  async store(params: {
    courseId: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<string | null> {
    const key = `memory://${params.courseId}`;
    this.files.set(key, params.contentType);
    return key;
  }
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
]);

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function validateImageUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    if (url.protocol === "http:" && !url.hostname.endsWith(".local")) {
      // Prefer HTTPS in production paths
    }
    const host = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host)) {
      return null;
    }
    if (
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("172.16.") ||
      host === "169.254.169.254"
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function fetchCourseImageSafely(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
): Promise<ImageFetchResult> {
  const parsed = validateImageUrl(rawUrl);
  if (!parsed) {
    return { ok: false, reason: "invalid_url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "image/*" },
    });

    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }

    const finalUrl = response.url;
    const finalParsed = validateImageUrl(finalUrl);
    if (!finalParsed) {
      return { ok: false, reason: "redirect_blocked" };
    }

    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) {
      return { ok: false, reason: "invalid_content_type" };
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return { ok: false, reason: "too_large" };
    }

    return {
      ok: true,
      contentType,
      bytes: buffer,
      finalUrl,
    };
  } catch {
    return { ok: false, reason: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function ingestCourseImage(params: {
  courseId: string;
  sourceUrl: string;
  policy?: ImagePolicy;
  storage?: CourseImageStorage;
  fetchImpl?: typeof fetch;
}): Promise<CourseImageMetadata> {
  const policy = params.policy ?? "REMOTE_ONLY";

  if (policy === "NO_EXTERNAL_IMAGE") {
    return {
      sourceUrl: null,
      storageUrl: null,
      lastVerifiedAt: null,
      policy,
    };
  }

  const fetched = await fetchCourseImageSafely(
    params.sourceUrl,
    params.fetchImpl,
  );
  if (!fetched.ok) {
    return {
      sourceUrl: params.sourceUrl,
      storageUrl: null,
      lastVerifiedAt: new Date(),
      policy,
    };
  }

  if (policy === "REMOTE_ONLY" || !params.storage) {
    return {
      sourceUrl: fetched.finalUrl,
      storageUrl: null,
      lastVerifiedAt: new Date(),
      policy: "REMOTE_ONLY",
    };
  }

  const stored = await params.storage.store({
    courseId: params.courseId,
    bytes: fetched.bytes,
    contentType: fetched.contentType,
  });

  return {
    sourceUrl: fetched.finalUrl,
    storageUrl: stored,
    lastVerifiedAt: new Date(),
    policy: "STORE_COPY",
  };
}
