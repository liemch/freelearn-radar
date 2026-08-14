import type { CourseCandidate } from "@/db/schema";

/** Tier-1 providers get a large boost in the review queue (M19 §79.5). */
const HIGH_TIER_PROVIDERS = new Set([
  "microsoft-learn",
  "freecodecamp",
  "coursera",
]);

const PRICE_TYPE_SCORES: Record<string, number> = {
  FREE_FULL: 40,
  FREE_AUDIT: 30,
  FREE_WITH_COUPON: 20,
  TEMPORARILY_FREE: 15,
  FREE_TRIAL: 5,
  PAID: -20,
  UNKNOWN: 0,
};

function readPriceTypeHint(aiAnalysisJson: unknown): string | null {
  if (!aiAnalysisJson || typeof aiAnalysisJson !== "object") {
    return null;
  }
  const priceType = (aiAnalysisJson as Record<string, unknown>).price_type;
  return typeof priceType === "string" ? priceType : null;
}

function readConfidence(candidate: CourseCandidate): number {
  const fromColumn = Number(candidate.confidence);
  if (Number.isFinite(fromColumn)) {
    return fromColumn;
  }
  if (
    candidate.aiAnalysisJson &&
    typeof candidate.aiAnalysisJson === "object" &&
    candidate.aiAnalysisJson !== null
  ) {
    const fromJson = Number(
      (candidate.aiAnalysisJson as Record<string, unknown>).confidence,
    );
    if (Number.isFinite(fromJson)) {
      return fromJson;
    }
  }
  return 0;
}

/**
 * Higher score = review sooner. Value-based ordering, not FIFO.
 */
export function scoreCandidateForReview(candidate: CourseCandidate): number {
  let score = 0;

  const provider = (candidate.provider ?? "").toLowerCase().trim();
  if (HIGH_TIER_PROVIDERS.has(provider)) {
    score += 50;
  } else if (provider) {
    score += 10;
  }

  const priceType = readPriceTypeHint(candidate.aiAnalysisJson);
  if (priceType && priceType in PRICE_TYPE_SCORES) {
    score += PRICE_TYPE_SCORES[priceType]!;
  }

  score += readConfidence(candidate) * 30;

  if (candidate.discoveryStatus === "ERROR") {
    score -= 40;
  }
  if (candidate.discoveryStatus === "READY_FOR_REVIEW") {
    score += 25;
  }

  return score;
}

export function sortCandidatesForReview<T extends CourseCandidate>(
  list: T[],
): T[] {
  return [...list].sort(
    (a, b) => scoreCandidateForReview(b) - scoreCandidateForReview(a),
  );
}
