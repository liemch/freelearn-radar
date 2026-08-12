/**
 * AI confidence is a model self-report, NOT an objective probability.
 * Conservative thresholds for routing only.
 */
export const AI_CONFIDENCE = {
  /** Below this → extra human review (ANALYZED status). */
  REVIEW_THRESHOLD: 0.55,
  /** Below this → treat AI enum suggestions as unusable. */
  SUGGESTION_FLOOR: 0.7,
} as const;

export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export function confidenceBand(
  value: number | string | null | undefined,
): ConfidenceBand {
  const n =
    typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n)) return "UNKNOWN";
  if (n >= 0.75) return "HIGH";
  if (n >= AI_CONFIDENCE.REVIEW_THRESHOLD) return "MEDIUM";
  if (n >= 0) return "LOW";
  return "UNKNOWN";
}

export function shouldRouteToExtraReview(
  confidence: number | null | undefined,
): boolean {
  if (confidence == null || !Number.isFinite(confidence)) {
    return true;
  }
  return confidence < AI_CONFIDENCE.REVIEW_THRESHOLD;
}

export function confidenceLabel(band: ConfidenceBand): string {
  switch (band) {
    case "HIGH":
      return "Higher model confidence (still requires human review)";
    case "MEDIUM":
      return "Moderate model confidence";
    case "LOW":
      return "Low model confidence — extra review recommended";
    default:
      return "Confidence unavailable";
  }
}
