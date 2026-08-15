/**
 * M21.3/M21.4 — Coupon discovery & verification (discovery ≠ Truth).
 */

import type { CouponOfferStatus } from "@/domain/course/types";
import { parseCourseOfferUrl } from "@/domain/coupon/offer-url";

export type CouponCandidateInput = {
  rawUrl: string;
  discoveredFrom?: string;
  sourceClaim?: string;
  sourcePrice?: number | null;
  sourceOriginalPrice?: number | null;
  sourceExpiresAt?: Date | null;
  titleHint?: string | null;
};

export type NormalizedCouponCandidate = {
  providerSlug: string;
  canonicalUrl: string;
  offerUrl: string;
  couponCode: string | null;
  discoveredFrom: string | null;
  sourceClaim: string | null;
  sourcePrice: string | null;
  sourceOriginalPrice: string | null;
  sourceExpiresAt: Date | null;
  status: CouponOfferStatus;
  lastError: string | null;
};

/**
 * Normalize an aggregator hit into a candidate. Missing coupon → INVALID.
 * Malformed URL → INVALID with error. Never marks ACTIVE_100_OFF.
 */
export function normalizeCouponCandidate(
  input: CouponCandidateInput,
): NormalizedCouponCandidate {
  try {
    const parsed = parseCourseOfferUrl(input.rawUrl);
    if (parsed.providerHint !== "udemy") {
      return {
        providerSlug: "unknown",
        canonicalUrl: parsed.canonicalUrl,
        offerUrl: parsed.offerUrl,
        couponCode: parsed.couponCode,
        discoveredFrom: input.discoveredFrom ?? null,
        sourceClaim: input.sourceClaim ?? null,
        sourcePrice: input.sourcePrice != null ? String(input.sourcePrice) : null,
        sourceOriginalPrice:
          input.sourceOriginalPrice != null
            ? String(input.sourceOriginalPrice)
            : null,
        sourceExpiresAt: input.sourceExpiresAt ?? null,
        status: "INVALID",
        lastError: "unsupported_provider",
      };
    }

    if (!parsed.couponCode) {
      return {
        providerSlug: "udemy",
        canonicalUrl: parsed.canonicalUrl,
        offerUrl: parsed.offerUrl,
        couponCode: null,
        discoveredFrom: input.discoveredFrom ?? null,
        sourceClaim: input.sourceClaim ?? null,
        sourcePrice: input.sourcePrice != null ? String(input.sourcePrice) : null,
        sourceOriginalPrice:
          input.sourceOriginalPrice != null
            ? String(input.sourceOriginalPrice)
            : null,
        sourceExpiresAt: input.sourceExpiresAt ?? null,
        status: "INVALID",
        lastError: "coupon_code_missing",
      };
    }

    return {
      providerSlug: "udemy",
      canonicalUrl: parsed.canonicalUrl,
      offerUrl: parsed.offerUrl,
      couponCode: parsed.couponCode,
      discoveredFrom: input.discoveredFrom ?? null,
      sourceClaim: input.sourceClaim ?? null,
      sourcePrice: input.sourcePrice != null ? String(input.sourcePrice) : null,
      sourceOriginalPrice:
        input.sourceOriginalPrice != null
          ? String(input.sourceOriginalPrice)
          : null,
      sourceExpiresAt: input.sourceExpiresAt ?? null,
      status: "DISCOVERED",
      lastError: null,
    };
  } catch (error) {
    return {
      providerSlug: "udemy",
      canonicalUrl: "",
      offerUrl: "",
      couponCode: null,
      discoveredFrom: input.discoveredFrom ?? null,
      sourceClaim: input.sourceClaim ?? null,
      sourcePrice: null,
      sourceOriginalPrice: null,
      sourceExpiresAt: null,
      status: "INVALID",
      lastError:
        error instanceof Error ? error.message : "malformed_offer_url",
    };
  }
}

/**
 * Extract Udemy course+coupon links from untrusted HTML (aggregator pages).
 * Does not copy editorial content — URLs only.
 */
export function extractUdemyOfferUrlsFromHtml(html: string): string[] {
  const urls = new Set<string>();
  const hrefRe =
    /href\s*=\s*["'](https?:\/\/(?:www\.)?udemy\.com\/course\/[^"'>\s]+)["']/gi;
  for (const match of html.matchAll(hrefRe)) {
    const raw = match[1]!.replace(/&amp;/g, "&");
    if (/couponCode=/i.test(raw) || /[?&]coupon=/i.test(raw)) {
      urls.add(raw);
    }
  }
  return [...urls];
}

export type CouponVerificationEvidence = {
  /** Official fetch succeeded within provider policy. */
  officialFetchOk: boolean;
  /** Provider blocked / CAPTCHA / bot protection. */
  blocked: boolean;
  /** Observed price after applying coupon (0 = 100% off). */
  priceAfterDiscount: number | null;
  /** Discount percent if known. */
  discountPercent: number | null;
  /** Coupon no longer accepted. */
  couponRejected: boolean;
  /** Offer past stated expiry. */
  pastExpiry: boolean;
  /** Recorded offer expiry, when the source or a previous fetch supplied one. */
  expiresAt?: Date | null;
};

/**
 * Map verification evidence → offer status.
 * Aggregator claims alone never produce ACTIVE_100_OFF.
 */
export function resolveCouponVerificationStatus(
  evidence: CouponVerificationEvidence,
  now: Date = new Date(),
): CouponOfferStatus {
  if (evidence.blocked) return "BLOCKED";
  if (!evidence.officialFetchOk) return "UNKNOWN";
  // A recorded expiry in the past is authoritative on its own: the clock does
  // not need the provider page to also say "ended" before an offer is over.
  if (evidence.expiresAt && evidence.expiresAt.getTime() <= now.getTime()) {
    return "EXPIRED";
  }
  if (evidence.pastExpiry) return "EXPIRED";
  if (evidence.couponRejected) return "INVALID";

  if (
    evidence.priceAfterDiscount === 0 ||
    evidence.discountPercent === 100
  ) {
    return "ACTIVE_100_OFF";
  }

  if (
    (evidence.discountPercent != null && evidence.discountPercent > 0) ||
    (evidence.priceAfterDiscount != null && evidence.priceAfterDiscount > 0)
  ) {
    return "ACTIVE_DISCOUNTED";
  }

  return "UNKNOWN";
}

/** Only ACTIVE_100_OFF may surface as "Coupon 100%". */
export function isPublicCoupon100Off(status: CouponOfferStatus): boolean {
  return status === "ACTIVE_100_OFF";
}

export type RecheckPriorityInput = {
  status: CouponOfferStatus;
  discoveredAt: Date;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  outboundClicks7d: number;
  now?: Date;
};

/**
 * Bounded recheck priority (higher = sooner). Does not schedule hammering.
 */
export function couponRecheckPriority(input: RecheckPriorityInput): number {
  const now = input.now ?? new Date();
  let score = 0;

  if (input.status === "ACTIVE_100_OFF" || input.status === "ACTIVE_DISCOUNTED") {
    score += 40;
  }
  if (input.status === "DISCOVERED" || input.status === "VERIFYING") {
    score += 50;
  }

  const ageHours =
    (now.getTime() - input.discoveredAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < 6) score += 25;
  else if (ageHours < 24) score += 10;

  if (input.expiresAt) {
    const hoursToExpiry =
      (input.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursToExpiry >= 0 && hoursToExpiry < 12) score += 30;
    else if (hoursToExpiry >= 0 && hoursToExpiry < 48) score += 15;
  }

  if (input.outboundClicks7d >= 20) score += 20;
  else if (input.outboundClicks7d >= 5) score += 10;

  if (input.verifiedAt) {
    const staleHours =
      (now.getTime() - input.verifiedAt.getTime()) / (1000 * 60 * 60);
    if (staleHours > 24) score += 15;
  }

  return score;
}

/** Next recheck delay based on status — backoff, not hammer. */
export function nextCouponRecheckAt(
  status: CouponOfferStatus,
  from: Date = new Date(),
): Date {
  const hours =
    status === "ACTIVE_100_OFF"
      ? 6
      : status === "ACTIVE_DISCOUNTED"
        ? 12
        : status === "UNKNOWN" || status === "BLOCKED"
          ? 48
          : status === "EXPIRED" || status === "INVALID"
            ? 168
            : 4;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}
