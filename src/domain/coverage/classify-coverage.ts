import { coverageThresholds } from "@/config/coverage-thresholds";

export type CoverageStatus = "EMPTY" | "THIN" | "HEALTHY" | "STRONG";

export type ProviderHealthStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "LOW_YIELD"
  | "FAILING"
  | "UNKNOWN";

/**
 * Primary coverage counts PUBLISHED + Truth-eligible courses only.
 * Callers must pass that count — drafts never inflate status.
 */
export function classifyCoverageCount(
  publishedEligibleCount: number,
  thresholds: Pick<
    typeof coverageThresholds,
    "emptyMax" | "thinMax" | "healthyMax"
  > = coverageThresholds,
): CoverageStatus {
  const n = Math.max(0, Math.floor(publishedEligibleCount));
  if (n <= thresholds.emptyMax) return "EMPTY";
  if (n <= thresholds.thinMax) return "THIN";
  if (n <= thresholds.healthyMax) return "HEALTHY";
  return "STRONG";
}

export function coverageStatusRank(status: CoverageStatus): number {
  switch (status) {
    case "EMPTY":
      return 0;
    case "THIN":
      return 1;
    case "HEALTHY":
      return 2;
    case "STRONG":
      return 3;
  }
}

/** Higher = schedule / interleave sooner. */
export function discoveryPriorityScore(input: {
  coverage: CoverageStatus;
  zeroResultDemand: number;
  recentYield: number | null;
}): number {
  let score = 0;
  switch (input.coverage) {
    case "EMPTY":
      score += 100;
      break;
    case "THIN":
      score += 70;
      break;
    case "HEALTHY":
      score += 30;
      break;
    case "STRONG":
      score += 10;
      break;
  }
  score += Math.min(40, input.zeroResultDemand * 2);
  if (input.recentYield != null) {
    if (input.recentYield <= 0.05) score -= 15;
    else if (input.recentYield >= 0.2) score += 10;
  }
  return score;
}

export function classifyProviderHealth(input: {
  sampleSize: number;
  failureRate: number | null;
  duplicateRate: number | null;
  daysSinceLastSuccess: number | null;
}): ProviderHealthStatus {
  const { minSample, failingFailureRate, lowYieldDuplicateRate, staleDays } =
    coverageThresholds.provider;

  if (input.sampleSize < minSample && input.daysSinceLastSuccess == null) {
    return "UNKNOWN";
  }

  if (
    input.failureRate != null &&
    input.failureRate >= failingFailureRate &&
    input.sampleSize >= minSample
  ) {
    return "FAILING";
  }

  if (
    input.daysSinceLastSuccess != null &&
    input.daysSinceLastSuccess >= staleDays
  ) {
    return "DEGRADED";
  }

  if (
    input.duplicateRate != null &&
    input.duplicateRate >= lowYieldDuplicateRate &&
    input.sampleSize >= minSample
  ) {
    return "LOW_YIELD";
  }

  if (input.sampleSize >= minSample) return "HEALTHY";
  return "UNKNOWN";
}

export function nextRunHoursForJunkRate(junkRate: number): number {
  const s = coverageThresholds.schedule;
  if (junkRate >= s.highJunkRate) return s.highJunkHours;
  if (junkRate >= s.mediumJunkRate) return s.mediumJunkHours;
  return s.successDefaultHours;
}

export function classifySearchOutcome(
  resultCount: number,
  lowResultMax = coverageThresholds.lowResultMax,
): "ZERO_RESULT" | "LOW_RESULT" | "HEALTHY_RESULT" {
  if (resultCount <= 0) return "ZERO_RESULT";
  if (resultCount <= lowResultMax) return "LOW_RESULT";
  return "HEALTHY_RESULT";
}
