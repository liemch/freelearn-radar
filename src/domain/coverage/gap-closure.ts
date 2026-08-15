import type { CoverageStatus } from "@/domain/coverage/classify-coverage";
import type { DemandBand } from "@/domain/coverage/growth-priority";

/**
 * Derived zero-result closure status — no new table.
 */
export type GapClosureStatus =
  | "OPEN"
  | "DISCOVERY_PLANNED"
  | "CANDIDATES_FOUND"
  | "COVERAGE_IMPROVED";

export function deriveGapClosureStatus(input: {
  coverage: CoverageStatus;
  demandBand: DemandBand;
  openCandidates: number;
  hasDryRunPlan: boolean;
  publishedEligible: number;
  /** Eligible published count when the gap was first noticed; optional. */
  publishedEligibleAtOpen?: number | null;
}): GapClosureStatus {
  const openedAt = input.publishedEligibleAtOpen ?? 0;

  if (
    input.publishedEligible > openedAt &&
    (input.coverage === "HEALTHY" ||
      input.coverage === "STRONG" ||
      input.publishedEligible >= 4)
  ) {
    return "COVERAGE_IMPROVED";
  }

  if (input.openCandidates > 0) return "CANDIDATES_FOUND";
  if (input.hasDryRunPlan && input.demandBand !== "NONE") {
    return "DISCOVERY_PLANNED";
  }
  if (
    (input.coverage === "EMPTY" || input.coverage === "THIN") &&
    input.demandBand !== "NONE"
  ) {
    return "OPEN";
  }
  if (input.coverage === "EMPTY" || input.coverage === "THIN") return "OPEN";
  return "COVERAGE_IMPROVED";
}
