export type RecommendationLabel =
  | "Highly Recommended"
  | "Recommended"
  | "Worth Exploring";

export function getRecommendationLabel(
  qualityScore: number | null | undefined,
): RecommendationLabel {
  const score = qualityScore ?? 0;

  if (score >= 85) {
    return "Highly Recommended";
  }

  if (score >= 70) {
    return "Recommended";
  }

  return "Worth Exploring";
}

export function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) {
    return null;
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.round((minutes / 60) * 10) / 10;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
