const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "source",
]);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith("utm_") || TRACKING_PARAMS.has(lower);
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    if (!url.hostname || url.hostname.includes(" ")) {
      return false;
    }
    // `https://udemy.com@evil.com/` navigates to evil.com while reading as a
    // trusted host, so userinfo is rejected outright.
    if (url.username || url.password) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Asserts a URL is safe for outbound redirects / provider navigation.
 * Rejects javascript:, data:, file:, and non-http(s) schemes.
 */
export function assertSafeHttpUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001F]/.test(trimmed)) {
    throw new Error("Unsafe external URL");
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("file:") ||
    lower.startsWith("vbscript:")
  ) {
    throw new Error("Unsafe external URL scheme");
  }

  // Protocol-relative URLs are ambiguous — reject
  if (trimmed.startsWith("//")) {
    throw new Error("Protocol-relative URLs are not allowed");
  }

  if (!isValidHttpUrl(trimmed)) {
    throw new Error(`Invalid external URL: ${trimmed}`);
  }

  return trimmed;
}

export function normalizeUrl(rawUrl: string): string {
  const safe = assertSafeHttpUrl(rawUrl);
  const url = new URL(safe);
  url.protocol = "https:";
  url.hash = "";

  if (url.hostname.startsWith("www.")) {
    url.hostname = url.hostname.slice(4);
  }

  if (url.hostname === "coursera.org" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  }

  const retained = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (!isTrackingParam(key)) {
      retained.append(key, value);
    }
  }

  const query = retained.toString();
  let pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return `https://${url.hostname}${pathname}${query ? `?${query}` : ""}`;
}
