import type {
  CertificateType,
  PriceType,
} from "@/domain/course/types";
import type { Course } from "@/db/schema";
import type { Provider } from "@/db/schema";
import { assertSafeHttpUrl } from "@/lib/url";
import { assessMetadataCompleteness } from "@/domain/quality/metadata-completeness";
import {
  assessCourseTrust,
  trustRankingMultiplier,
  type TrustState,
} from "@/domain/verification/trust";
import { daysSince } from "@/domain/verification/freshness-policy";

/** Ranking weights (project plan §20). Documented to avoid magic-number drift. */
export const RANKING_WEIGHTS = {
  quality: 0.3,
  freshness: 0.25,
  popularity: 0.15,
  freeValue: 0.2,
  editorial: 0.1,
} as const;

/**
 * Freshness prefers lastVerifiedAt; falls back to publishedAt.
 * Stale verification ages faster than publish age alone.
 */
export function computeFreshnessScore(
  publishedAt: Date | null | undefined,
  now = new Date(),
  lastVerifiedAt?: Date | null,
): number {
  const anchor = lastVerifiedAt ?? publishedAt;
  if (!anchor) {
    return 10;
  }

  const days = daysSince(anchor, now);

  if (days < 7) return 100;
  if (days < 14) return 80;
  if (days < 30) return 60;
  if (days < 90) return 30;
  return 10;
}

export function computeFreeValueScore(priceType: PriceType): number {
  switch (priceType) {
    case "FREE_FULL":
      return 100;
    case "TEMPORARILY_FREE":
      return 90;
    case "FREE_WITH_COUPON":
      return 75;
    case "FREE_AUDIT":
      return 70;
    case "FREE_TRIAL":
      return 40;
    case "PAID":
      return 10;
    default:
      return 20;
  }
}

export function computePopularityScore(
  ratingCount: number | null | undefined,
): number {
  if (!ratingCount || ratingCount <= 0) return 10;
  if (ratingCount >= 10_000) return 100;
  if (ratingCount >= 1_000) return 80;
  if (ratingCount >= 100) return 60;
  if (ratingCount >= 20) return 40;
  return 20;
}

export function computeRankingScore(input: {
  qualityScore?: number | null;
  freshnessScore: number;
  popularityScore: number;
  freeValueScore: number;
  editorialScore?: number | null;
  trustMultiplier?: number;
}): number {
  const quality = input.qualityScore ?? 50;
  const editorial = input.editorialScore ?? 50;
  const trustMultiplier = input.trustMultiplier ?? 1;

  const base =
    quality * RANKING_WEIGHTS.quality +
    input.freshnessScore * RANKING_WEIGHTS.freshness +
    input.popularityScore * RANKING_WEIGHTS.popularity +
    input.freeValueScore * RANKING_WEIGHTS.freeValue +
    editorial * RANKING_WEIGHTS.editorial;

  return base * trustMultiplier;
}

export function estimateTrustStateForCourse(
  course: Pick<
    Course,
    | "priceType"
    | "certificateType"
    | "lastVerifiedAt"
    | "title"
    | "canonicalUrl"
    | "description"
    | "shortDescription"
    | "language"
    | "level"
    | "durationMinutes"
    | "instructor"
  > & { providerName?: string | null },
  now = new Date(),
): TrustState {
  const completeness = assessMetadataCompleteness({
    title: course.title,
    provider: course.providerName,
    canonicalUrl: course.canonicalUrl,
    description: course.description || course.shortDescription,
    hasCategory: true,
    level: course.level,
    language: course.language,
    durationMinutes: course.durationMinutes,
    priceType: course.priceType,
    certificateType: course.certificateType,
    lastVerifiedAt: course.lastVerifiedAt,
  });

  return assessCourseTrust({
    lastVerifiedAt: course.lastVerifiedAt,
    verificationSucceeded: Boolean(course.lastVerifiedAt),
    priceType: course.priceType,
    certificateType: course.certificateType,
    pricingConfidence: course.priceType === "UNKNOWN" ? 0.3 : 0.75,
    certificateConfidence: course.certificateType === "UNKNOWN" ? 0.3 : 0.7,
    metadataCompleteness: completeness.score,
    sourceScore: 70,
    now,
  }).state;
}

export function rankCourses<T extends Course>(
  courses: T[],
  now = new Date(),
): Array<T & { rankingScore: number; trustState: TrustState }> {
  return courses
    .map((course) => {
      const freshnessScore = computeFreshnessScore(
        course.publishedAt,
        now,
        course.lastVerifiedAt,
      );
      const freeValueScore = computeFreeValueScore(course.priceType);
      const popularityScore = computePopularityScore(course.ratingCount);
      const trustState = estimateTrustStateForCourse(course, now);
      const rankingScore = computeRankingScore({
        qualityScore: course.qualityScore,
        freshnessScore,
        popularityScore,
        freeValueScore,
        editorialScore: course.editorScore,
        trustMultiplier: trustRankingMultiplier(trustState),
      });

      return { ...course, rankingScore, trustState };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore);
}

/**
 * Builds a safe outbound destination URL.
 * Priority: affiliate_url → provider affiliate template → outbound/canonical.
 * Always validates http(s) before returning.
 */
export function buildOutboundUrl(
  course: Pick<Course, "affiliateUrl" | "outboundUrl" | "canonicalUrl">,
  provider?: Pick<Provider, "affiliateEnabled" | "affiliateTemplate"> | null,
): string {
  const candidates: string[] = [];

  if (course.affiliateUrl) {
    candidates.push(course.affiliateUrl);
  }

  if (
    provider?.affiliateEnabled &&
    provider.affiliateTemplate &&
    provider.affiliateTemplate.includes("{url}")
  ) {
    candidates.push(
      provider.affiliateTemplate.replace(
        "{url}",
        encodeURIComponent(course.canonicalUrl),
      ),
    );
  }

  if (course.outboundUrl) {
    candidates.push(course.outboundUrl);
  }

  candidates.push(course.canonicalUrl);

  for (const candidate of candidates) {
    try {
      return assertSafeHttpUrl(candidate);
    } catch {
      // try next fallback
    }
  }

  throw new Error("No safe outbound URL available");
}

export function certificateValue(certificateType: CertificateType): number {
  switch (certificateType) {
    case "FREE_CERTIFICATE":
      return 100;
    case "PAID_CERTIFICATE":
      return 50;
    case "NO_CERTIFICATE":
      return 20;
    default:
      return 10;
  }
}
