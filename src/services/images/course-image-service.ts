/**
 * Course image fetch + storage abstraction (M18.2).
 * Storage is mockable — no live Vercel Blob credentials required in CI.
 */

import { validateSafeFetchUrl } from "@/lib/safe-fetch-url";

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

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_REDIRECTS = 3;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * External image URLs are untrusted input, so this shares the single SSRF
 * validator with the HTML fetch path rather than keeping a second, weaker set
 * of host rules. `validateSafeFetchUrl` covers private and reserved IPv4/IPv6
 * ranges, obfuscated IP literals, credentials in URL, and metadata endpoints.
 */
export function validateImageUrl(raw: string): URL | null {
  const result = validateSafeFetchUrl(raw);
  return result.ok ? result.url : null;
}

function isRedirectStatus(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

/**
 * Fetches an image with manual redirect handling: every hop is re-validated
 * before it is requested, so a trusted host cannot bounce the fetch onto an
 * internal address. Automatic `redirect: "follow"` would issue those requests
 * before any check could run.
 */
export async function fetchCourseImageSafely(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
): Promise<ImageFetchResult> {
  const parsed = validateImageUrl(rawUrl);
  if (!parsed) {
    return { ok: false, reason: "invalid_url" };
  }

  let current = parsed.toString();

  for (let hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: { Accept: "image/*" },
      });

      if (isRedirectStatus(response.status)) {
        if (hop === MAX_IMAGE_REDIRECTS) {
          return { ok: false, reason: "too_many_redirects" };
        }
        const location = response.headers.get("location");
        if (!location) {
          return { ok: false, reason: "redirect_missing_location" };
        }
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          return { ok: false, reason: "redirect_blocked" };
        }
        if (!validateImageUrl(next.toString())) {
          return { ok: false, reason: "redirect_blocked" };
        }
        current = next.toString();
        continue;
      }

      if (!response.ok) {
        return { ok: false, reason: `http_${response.status}` };
      }

      const contentType = (response.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED_TYPES.has(contentType)) {
        return { ok: false, reason: "invalid_content_type" };
      }

      // Reject on the declared length before buffering when the server is
      // honest about it; the post-read check still covers a lying header.
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
        return { ok: false, reason: "too_large" };
      }

      const buffer = new Uint8Array(await response.arrayBuffer());
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        return { ok: false, reason: "too_large" };
      }

      return {
        ok: true,
        contentType,
        bytes: buffer,
        finalUrl: current,
      };
    } catch {
      return { ok: false, reason: "fetch_failed" };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, reason: "too_many_redirects" };
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
