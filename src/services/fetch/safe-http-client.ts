import { validateSafeFetchUrl } from "@/lib/safe-fetch-url";

export type SafeHttpFetchOptions = {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  accept?: string;
  fetchImpl?: typeof fetch;
};

export type SafeHttpFetchSuccess = {
  ok: true;
  status: number;
  finalUrl: string;
  contentType: string;
  body: string;
  redirectChain: string[];
  fetchedAt: Date;
};

export type SafeHttpFetchFailure = {
  ok: false;
  reason: string;
  status?: number;
  finalUrl?: string;
  redirectChain: string[];
  fetchedAt: Date;
};

export type SafeHttpFetchResult = SafeHttpFetchSuccess | SafeHttpFetchFailure;

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = 512 * 1024;

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * SSRF-safe HTTP GET with manual redirect validation, timeout, and size cap.
 * Does not use automatic redirect following.
 */
export async function safeHttpGet(
  requestedUrl: string,
  options: SafeHttpFetchOptions = {},
): Promise<SafeHttpFetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const fetchImpl = options.fetchImpl ?? fetch;
  const accept = options.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1";
  const fetchedAt = new Date();
  const redirectChain: string[] = [];

  const initial = validateSafeFetchUrl(requestedUrl);
  if (!initial.ok) {
    return {
      ok: false,
      reason: initial.reason,
      redirectChain,
      fetchedAt,
    };
  }

  let current = initial.url.toString();

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: accept,
          "User-Agent": "FreeLearnRadarSourceFetcher/1.0 (+https://freelearnradar.local)",
        },
      });

      if (isRedirect(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return {
            ok: false,
            reason: "redirect_missing_location",
            status: response.status,
            finalUrl: current,
            redirectChain,
            fetchedAt,
          };
        }

        let nextUrl: URL;
        try {
          nextUrl = new URL(location, current);
        } catch {
          return {
            ok: false,
            reason: "redirect_invalid_location",
            status: response.status,
            finalUrl: current,
            redirectChain,
            fetchedAt,
          };
        }

        const safeNext = validateSafeFetchUrl(nextUrl.toString());
        if (!safeNext.ok) {
          return {
            ok: false,
            reason: `redirect_${safeNext.reason}`,
            status: response.status,
            finalUrl: current,
            redirectChain,
            fetchedAt,
          };
        }

        redirectChain.push(nextUrl.toString());
        if (hop === maxRedirects) {
          return {
            ok: false,
            reason: "too_many_redirects",
            status: response.status,
            finalUrl: current,
            redirectChain,
            fetchedAt,
          };
        }
        current = nextUrl.toString();
        continue;
      }

      if (!response.ok) {
        return {
          ok: false,
          reason: `http_${response.status}`,
          status: response.status,
          finalUrl: current,
          redirectChain,
          fetchedAt,
        };
      }

      const contentType = (response.headers.get("content-type") ?? "")
        .split(";")[0]
        ?.trim()
        .toLowerCase() ?? "";

      if (
        contentType &&
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml") &&
        !contentType.includes("text/plain") &&
        !contentType.includes("application/json")
      ) {
        return {
          ok: false,
          reason: "unsupported_content_type",
          status: response.status,
          finalUrl: current,
          redirectChain,
          fetchedAt,
        };
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxBytes) {
        return {
          ok: false,
          reason: "response_too_large",
          status: response.status,
          finalUrl: current,
          redirectChain,
          fetchedAt,
        };
      }

      const body = new TextDecoder("utf-8", { fatal: false }).decode(buffer);

      return {
        ok: true,
        status: response.status,
        finalUrl: current,
        contentType: contentType || "text/html",
        body,
        redirectChain,
        fetchedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "fetch_failed";
      const reason = /abort/i.test(message) ? "timeout" : "network_error";
      return {
        ok: false,
        reason,
        finalUrl: current,
        redirectChain,
        fetchedAt,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    reason: "too_many_redirects",
    finalUrl: current,
    redirectChain,
    fetchedAt,
  };
}
