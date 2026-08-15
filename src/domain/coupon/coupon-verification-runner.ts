/**
 * M21.4/11 — Official coupon verification (never invent ACTIVE_100_OFF).
 */

import type { Db } from "@/db";
import {
  listCouponCandidates,
  listOffersDueForRecheck,
  updateCouponCandidateStatus,
  updateCourseOfferStatus,
  upsertCourseOffer,
} from "@/db/repositories/coupon-repository";
import { findCourseByCanonicalUrl } from "@/db/repositories/course-repository";
import { findProviderBySlug } from "@/db/repositories/provider-repository";
import type { CourseOffer } from "@/db/schema";
import {
  nextCouponRecheckAt,
  resolveCouponVerificationStatus,
  type CouponVerificationEvidence,
} from "@/domain/coupon/coupon-service";
import type { CouponOfferStatus } from "@/domain/course/types";
import { classifyFreeStatusFromText } from "@/domain/verification/free-status";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeHttpGet } from "@/services/fetch/safe-http-client";

export type CouponVerificationSummary = {
  enabled: boolean;
  candidatesProcessed: number;
  offersVerified: number;
  active100: number;
  unknown: number;
  blocked: number;
  expired: number;
  invalid: number;
  errors: number;
  skippedReason: string | null;
};

function emptySummary(
  partial: Partial<CouponVerificationSummary> = {},
): CouponVerificationSummary {
  return {
    enabled: false,
    candidatesProcessed: 0,
    offersVerified: 0,
    active100: 0,
    unknown: 0,
    blocked: 0,
    expired: 0,
    invalid: 0,
    errors: 0,
    skippedReason: null,
    ...partial,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!);
    }
  }

  const poolSize = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));
  return results;
}

function looksBlocked(status: number | undefined, body: string): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  const text = body.toLowerCase();
  return (
    /captcha/.test(text) ||
    /bot.?detection/.test(text) ||
    /access.?denied/.test(text) ||
    /cf-browser-verification/.test(text)
  );
}

/**
 * Build verification evidence from an official offer fetch.
 * Without a successful official fetch → UNKNOWN/BLOCKED only.
 */
export function evidenceFromOfficialFetch(input: {
  ok: boolean;
  status?: number;
  body?: string;
  reason?: string;
}): CouponVerificationEvidence & { lastError: string | null } {
  if (!input.ok) {
    const blocked = looksBlocked(input.status, input.body ?? "");
    return {
      officialFetchOk: false,
      blocked,
      priceAfterDiscount: null,
      discountPercent: null,
      couponRejected: false,
      pastExpiry: false,
      lastError: input.reason ?? (blocked ? "official_fetch_blocked" : "official_fetch_failed"),
    };
  }

  const body = input.body ?? "";
  if (looksBlocked(input.status, body)) {
    return {
      officialFetchOk: false,
      blocked: true,
      priceAfterDiscount: null,
      discountPercent: null,
      couponRejected: false,
      pastExpiry: false,
      lastError: "official_fetch_blocked",
    };
  }

  const free = classifyFreeStatusFromText(body);
  const couponRejected =
    /coupon.*(invalid|expired|not apply|doesn't apply|does not apply)/i.test(
      body,
    ) || /this coupon.*(expired|invalid)/i.test(body);

  const pastExpiry = /offer.*(expired|ended)/i.test(body);

  let priceAfterDiscount: number | null = null;
  let discountPercent: number | null = null;

  if (
    free.priceType === "FREE_WITH_COUPON" ||
    /\b100%\s*off\b/i.test(body) ||
    /\$0(\.00)?\b/.test(body)
  ) {
    // Conservative: only treat as 100% when free-with-coupon / $0 signals are strong.
    if (
      free.priceType === "FREE_WITH_COUPON" ||
      /\b100%\s*off\b/i.test(body) ||
      (/\$0(\.00)?\b/.test(body) && /\bcoupon\b/i.test(body))
    ) {
      priceAfterDiscount = 0;
      discountPercent = 100;
    }
  } else {
    // A partial discount is evidence too. Without extracting it the offer fell
    // through to UNKNOWN, so ACTIVE_DISCOUNTED was effectively unreachable and
    // the recheck cadence used the wrong backoff. 100 is excluded here because
    // the branch above owns that case and requires stronger signals for it.
    const percentMatch = body.match(/\b([1-9]\d?)\s*%\s*off\b/i);
    if (percentMatch) {
      const percent = Number(percentMatch[1]);
      if (percent > 0 && percent < 100) {
        discountPercent = percent;
      }
    }

    const priceMatch = body.match(/\$\s*([1-9]\d*(?:\.\d{1,2})?)/);
    if (priceMatch) {
      priceAfterDiscount = Number(priceMatch[1]);
    }
  }

  return {
    officialFetchOk: true,
    blocked: false,
    priceAfterDiscount,
    discountPercent,
    couponRejected,
    pastExpiry,
    lastError: null,
  };
}

function bumpStatusCount(
  summary: CouponVerificationSummary,
  status: CouponOfferStatus,
) {
  if (status === "ACTIVE_100_OFF") summary.active100 += 1;
  else if (status === "BLOCKED") summary.blocked += 1;
  else if (status === "EXPIRED") summary.expired += 1;
  else if (status === "INVALID") summary.invalid += 1;
  else if (status === "UNKNOWN") summary.unknown += 1;
}

async function verifyOfferUrl(
  offerUrl: string,
  expiresAt: Date | null = null,
): Promise<{
  status: CouponOfferStatus;
  lastError: string | null;
  priceAfterDiscount: string | null;
  discountPercent: number | null;
}> {
  const env = getServerEnv();
  const http = await safeHttpGet(offerUrl, {
    timeoutMs: env.SOURCE_FETCH_TIMEOUT_MS,
    maxRedirects: env.SOURCE_MAX_REDIRECTS,
    maxBytes: env.SOURCE_MAX_RESPONSE_BYTES,
  });

  const evidence = evidenceFromOfficialFetch(
    http.ok
      ? { ok: true, status: http.status, body: http.body }
      : {
          ok: false,
          status: http.status,
          reason: http.reason,
        },
  );

  const status = resolveCouponVerificationStatus({ ...evidence, expiresAt });
  return {
    status,
    lastError: evidence.lastError,
    priceAfterDiscount:
      evidence.priceAfterDiscount != null
        ? String(evidence.priceAfterDiscount)
        : null,
    discountPercent: evidence.discountPercent,
  };
}

async function applyOfferVerification(
  db: Db,
  offer: CourseOffer,
  summary: CouponVerificationSummary,
) {
  const result = await verifyOfferUrl(offer.offerUrl, offer.expiresAt);
  const now = new Date();
  await updateCourseOfferStatus(db, offer.id, {
    status: result.status,
    verifiedAt: result.status === "UNKNOWN" || result.status === "BLOCKED"
      ? offer.verifiedAt
      : now,
    nextRecheckAt: nextCouponRecheckAt(result.status, now),
    lastError: result.lastError,
    priceAfterDiscount: result.priceAfterDiscount,
    discountPercent: result.discountPercent,
  });
  summary.offersVerified += 1;
  bumpStatusCount(summary, result.status);
}

/**
 * Promote DISCOVERED candidates into course_offers and recheck due offers.
 * Local/CI without live Udemy → UNKNOWN with lastError (never fake ACTIVE_100_OFF).
 */
export async function runCouponVerification(
  db: Db,
  options?: {
    concurrency?: number;
    limit?: number;
  },
): Promise<CouponVerificationSummary> {
  const env = getServerEnv();
  if (env.FEATURE_COUPON_DISCOVERY !== "true") {
    return emptySummary({
      skippedReason: "FEATURE_COUPON_DISCOVERY_off",
    });
  }

  const concurrency = options?.concurrency ?? env.COUPON_VERIFY_CONCURRENCY;
  const limit = options?.limit ?? env.COUPON_VERIFY_LIMIT;
  const summary = emptySummary({ enabled: true });

  const candidates = await listCouponCandidates(db, {
    status: "DISCOVERED",
    limit,
  });

  for (const candidate of candidates) {
    summary.candidatesProcessed += 1;
    try {
      await updateCouponCandidateStatus(db, candidate.id, {
        status: "VERIFYING",
      });

      const course = candidate.canonicalUrl
        ? await findCourseByCanonicalUrl(db, candidate.canonicalUrl)
        : null;

      // provider_id must be populated, not just provider_slug: the public
      // daily-free query joins providers through it, and a null there silently
      // drops the offer from the surface. Prefer the resolved course's provider,
      // fall back to the slug the candidate carried.
      const providerId =
        course?.providerId ??
        (await findProviderBySlug(db, candidate.providerSlug))?.id ??
        null;

      const offer = await upsertCourseOffer(db, {
        courseId: course?.id ?? null,
        providerId,
        providerSlug: candidate.providerSlug,
        canonicalUrl: candidate.canonicalUrl,
        offerUrl: candidate.offerUrl,
        couponCode: candidate.couponCode,
        offerType: "COUPON",
        status: "VERIFYING",
        discoveredFrom: candidate.discoveredFrom,
        discoveredAt: candidate.discoveredAt,
        expiresAt: candidate.sourceExpiresAt,
        candidateId: candidate.id,
        lastError: null,
      });

      const result = await verifyOfferUrl(
        candidate.offerUrl,
        candidate.sourceExpiresAt,
      );
      const now = new Date();

      await updateCourseOfferStatus(db, offer.id, {
        status: result.status,
        verifiedAt:
          result.status === "UNKNOWN" || result.status === "BLOCKED"
            ? null
            : now,
        nextRecheckAt: nextCouponRecheckAt(result.status, now),
        lastError: result.lastError,
        priceAfterDiscount: result.priceAfterDiscount,
        discountPercent: result.discountPercent,
        courseId: course?.id ?? null,
      });

      await updateCouponCandidateStatus(db, candidate.id, {
        status: result.status,
        courseId: course?.id ?? null,
        lastError: result.lastError,
      });

      summary.offersVerified += 1;
      bumpStatusCount(summary, result.status);
    } catch (error) {
      summary.errors += 1;
      await updateCouponCandidateStatus(db, candidate.id, {
        status: "UNKNOWN",
        lastError:
          error instanceof Error ? error.message : "verification_exception",
      });
      logger.warn("coupon.verify.candidate", {
        status: "error",
        candidateId: candidate.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const due = await listOffersDueForRecheck(db, limit);
  const already = new Set(candidates.map((c) => c.offerUrl));
  const recheck = due.filter((offer) => !already.has(offer.offerUrl));

  await mapPool(recheck, concurrency, async (offer) => {
    try {
      await applyOfferVerification(db, offer, summary);
    } catch (error) {
      summary.errors += 1;
      await updateCourseOfferStatus(db, offer.id, {
        status: "UNKNOWN",
        lastError:
          error instanceof Error ? error.message : "verification_exception",
        nextRecheckAt: nextCouponRecheckAt("UNKNOWN"),
      });
      logger.warn("coupon.verify.offer", {
        status: "error",
        offerId: offer.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  logger.info("coupon.verify", { status: "success", ...summary });
  return summary;
}
