import type { CoverageStatus } from "@/domain/coverage/classify-coverage";
import { discoveryPriorityScore } from "@/domain/coverage/classify-coverage";
import type { ProviderHealthStatus } from "@/domain/coverage/classify-coverage";

export type GrowthPriority = "P0_GAP" | "P1_HIGH" | "P2_NORMAL" | "P3_LOW";

export type DemandBand = "NONE" | "LOW" | "MEDIUM" | "HIGH";

/**
 * Transparent catalog-growth priority (M27).
 * Affiliate / commission must never appear in inputs.
 */
export function classifyDemandBand(searchCount30d: number): DemandBand {
  if (searchCount30d <= 0) return "NONE";
  if (searchCount30d <= 2) return "LOW";
  if (searchCount30d <= 8) return "MEDIUM";
  return "HIGH";
}

export function classifyGrowthPriority(input: {
  coverage: CoverageStatus;
  demandBand: DemandBand;
  providerHealthBest: ProviderHealthStatus | null;
  recentYield: number | null;
}): GrowthPriority {
  const { coverage, demandBand, providerHealthBest, recentYield } = input;

  if (coverage === "EMPTY" && (demandBand === "HIGH" || demandBand === "MEDIUM")) {
    return "P0_GAP";
  }
  if (coverage === "EMPTY") return "P0_GAP";

  if (
    coverage === "THIN" &&
    (demandBand === "HIGH" || demandBand === "MEDIUM")
  ) {
    return "P1_HIGH";
  }

  if (coverage === "THIN") return "P1_HIGH";

  if (
    coverage === "HEALTHY" &&
    demandBand === "HIGH" &&
    (recentYield == null || recentYield < 0.15)
  ) {
    return "P2_NORMAL";
  }

  if (coverage === "STRONG" && demandBand !== "HIGH") return "P3_LOW";
  if (coverage === "STRONG") return "P3_LOW";

  if (
    providerHealthBest === "FAILING" ||
    providerHealthBest === "DEGRADED"
  ) {
    // Gap still matters, but operator should fix provider first when HEALTHY.
    if (coverage === "HEALTHY") return "P2_NORMAL";
  }

  return "P2_NORMAL";
}

export function growthPriorityRank(priority: GrowthPriority): number {
  switch (priority) {
    case "P0_GAP":
      return 0;
    case "P1_HIGH":
      return 1;
    case "P2_NORMAL":
      return 2;
    case "P3_LOW":
      return 3;
  }
}

export function explainGrowthPriority(input: {
  coverage: CoverageStatus;
  demandBand: DemandBand;
  priority: GrowthPriority;
}): string {
  const parts = [
    `Coverage ${input.coverage}`,
    `demand ${input.demandBand}`,
  ];
  switch (input.priority) {
    case "P0_GAP":
      return `${parts.join(", ")} → ưu tiên lấp khoảng trống.`;
    case "P1_HIGH":
      return `${parts.join(", ")} → bổ sung sớm, vẫn giữ Truth.`;
    case "P2_NORMAL":
      return `${parts.join(", ")} → cadence bình thường.`;
    case "P3_LOW":
      return `${parts.join(", ")} → không cần chạy discovery thêm.`;
  }
}

/** Score used only to order recommendations within a priority class. */
export function recommendationSortScore(input: {
  coverage: CoverageStatus;
  zeroResultDemand: number;
  recentYield: number | null;
}): number {
  return discoveryPriorityScore({
    coverage: input.coverage,
    zeroResultDemand: input.zeroResultDemand,
    recentYield: input.recentYield,
  });
}

export function boundedCandidateBudget(input: {
  priority: GrowthPriority;
  queryCount: number;
  resultLimitPerQuery?: number;
}): { queries: number; maxPerQuery: number; maxCandidates: number } {
  const maxPerQuery = input.resultLimitPerQuery ?? 10;
  const queries = Math.min(
    Math.max(0, input.queryCount),
    input.priority === "P0_GAP" ? 5 : input.priority === "P1_HIGH" ? 3 : 2,
  );
  return {
    queries,
    maxPerQuery,
    maxCandidates: queries * maxPerQuery,
  };
}
