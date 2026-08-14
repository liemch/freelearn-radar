/**
 * M21.3 — Canonical course identity vs coupon offer identity.
 *
 * Invariant: couponCode must not be stripped before offer is parsed/stored.
 * Tracking params may still be removed. canonical_url ≠ offer_url when a coupon
 * is present.
 */

import { assertSafeHttpUrl, normalizeUrl } from "@/lib/url";

const COUPON_PARAM_KEYS = new Set([
  "couponcode",
  "coupon_code",
  "coupon",
  "promo",
  "promocode",
  "promo_code",
  "code",
]);

export type ParsedCourseOfferUrl = {
  /** Safe original URL (http/https asserted). */
  rawUrl: string;
  /** Identity without coupon / promo params (course page). */
  canonicalUrl: string;
  /** Normalized URL retaining coupon params (and other non-tracking params). */
  offerUrl: string;
  couponCode: string | null;
  providerHint: "udemy" | "other";
};

function extractCouponCode(url: URL): string | null {
  for (const [key, value] of url.searchParams.entries()) {
    if (COUPON_PARAM_KEYS.has(key.toLowerCase()) && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function stripCouponParams(url: URL): URL {
  const cleaned = new URL(url.toString());
  for (const key of [...cleaned.searchParams.keys()]) {
    if (COUPON_PARAM_KEYS.has(key.toLowerCase())) {
      cleaned.searchParams.delete(key);
    }
  }
  return cleaned;
}

function detectProvider(hostname: string): "udemy" | "other" {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  if (host === "udemy.com" || host.endsWith(".udemy.com")) {
    return "udemy";
  }
  return "other";
}

/**
 * Parse a provider course URL into canonical identity + offer identity.
 * Does not fetch. Does not treat aggregator claim as Truth.
 */
export function parseCourseOfferUrl(raw: string): ParsedCourseOfferUrl {
  const safe = assertSafeHttpUrl(raw.trim());
  const parsed = new URL(safe);
  const couponCode = extractCouponCode(parsed);
  const withoutCoupon = stripCouponParams(parsed);

  // normalizeUrl strips tracking but keeps couponCode — use it for offerUrl.
  const offerUrl = normalizeUrl(safe);
  // Canonical must drop coupon params after tracking strip.
  const canonicalUrl = normalizeUrl(withoutCoupon.toString());

  return {
    rawUrl: safe,
    canonicalUrl,
    offerUrl,
    couponCode,
    providerHint: detectProvider(parsed.hostname),
  };
}

/**
 * Build an offer URL from a canonical course URL + coupon code.
 */
export function buildOfferUrl(canonicalUrl: string, couponCode: string): string {
  const safe = assertSafeHttpUrl(canonicalUrl.trim());
  const url = new URL(safe);
  url.searchParams.set("couponCode", couponCode.trim());
  return normalizeUrl(url.toString());
}

export function isUdemyCoursePath(pathname: string): boolean {
  return /\/course\/[^/]+\/?$/i.test(pathname) || /\/course\/[^/]+\//i.test(pathname);
}
