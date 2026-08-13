/**
 * Outbound URL safety for SSRF prevention (HTML fetch + redirects).
 * Complements assertSafeHttpUrl with host/IP range checks.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

function isIpv4(hostname: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

function parseIpv4(hostname: string): number[] | null {
  if (!isIpv4(hostname)) return null;
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts;
}

function isPrivateOrReservedIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local / metadata
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isBlockedIpv6(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
  if (host.startsWith("fc") || host.startsWith("fd")) return true; // ULA
  if (host.startsWith("fe80")) return true; // link-local
  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  const mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) {
    const parts = parseIpv4(mapped[1]!);
    return !parts || isPrivateOrReservedIpv4(parts);
  }
  return false;
}

export type SafeFetchUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/**
 * Validate a URL for outbound HTML/image fetch. Rejects unsafe schemes,
 * credentials, localhost, private/reserved IPs, and metadata endpoints.
 */
export function validateSafeFetchUrl(raw: string): SafeFetchUrlResult {
  const trimmed = raw.trim();
  if (!trimmed || /[\u0000-\u001F]/.test(trimmed)) {
    return { ok: false, reason: "invalid_characters" };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("file:") ||
    lower.startsWith("ftp:") ||
    lower.startsWith("vbscript:") ||
    trimmed.startsWith("//")
  ) {
    return { ok: false, reason: "unsafe_scheme" };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unsafe_scheme" };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "credentials_in_url" };
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname || hostname.includes(" ")) {
    return { ok: false, reason: "invalid_hostname" };
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    return { ok: false, reason: "blocked_hostname" };
  }

  if (hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "[::1]") {
    return { ok: false, reason: "loopback" };
  }

  const ipv4 = parseIpv4(hostname);
  if (ipv4 && isPrivateOrReservedIpv4(ipv4)) {
    return { ok: false, reason: "private_or_reserved_ip" };
  }

  if (hostname.includes(":") && isBlockedIpv6(hostname)) {
    return { ok: false, reason: "private_or_reserved_ip" };
  }

  // Decimal / hex IP obfuscation (e.g. http://2130706433)
  if (/^\d+$/.test(hostname)) {
    return { ok: false, reason: "obfuscated_ip" };
  }

  return { ok: true, url };
}

export function isSafeFetchUrl(raw: string): boolean {
  return validateSafeFetchUrl(raw).ok;
}
