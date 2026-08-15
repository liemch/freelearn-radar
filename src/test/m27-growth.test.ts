import { describe, expect, it } from "vitest";

import { deriveGapClosureStatus } from "@/domain/coverage/gap-closure";
import {
  boundedCandidateBudget,
  classifyDemandBand,
  classifyGrowthPriority,
} from "@/domain/coverage/growth-priority";
import { diffCatalogSnapshots } from "@/domain/coverage/growth-snapshot";
import type { CatalogGrowthSnapshot } from "@/domain/coverage/growth-snapshot";
import { diagnoseProvider } from "@/domain/coverage/provider-diagnostics";
import {
  computeYieldMetrics,
  deltaRate,
  YIELD_FIXTURE_SAMPLES,
} from "@/domain/coverage/discovery-yield";
import type { ProviderEffectivenessRow } from "@/domain/coverage/provider-effectiveness";

describe("M27 growth priority", () => {
  it("marks EMPTY + HIGH demand as P0_GAP", () => {
    expect(
      classifyGrowthPriority({
        coverage: "EMPTY",
        demandBand: classifyDemandBand(20),
        providerHealthBest: "HEALTHY",
        recentYield: 0.2,
      }),
    ).toBe("P0_GAP");
  });

  it("marks STRONG coverage as P3_LOW", () => {
    expect(
      classifyGrowthPriority({
        coverage: "STRONG",
        demandBand: "HIGH",
        providerHealthBest: "HEALTHY",
        recentYield: 0.3,
      }),
    ).toBe("P3_LOW");
  });

  it("bounds candidate budgets", () => {
    expect(
      boundedCandidateBudget({ priority: "P0_GAP", queryCount: 10 }),
    ).toEqual({ queries: 5, maxPerQuery: 10, maxCandidates: 50 });
  });
});

describe("M27 provider diagnostics", () => {
  it("classifies duplicate-heavy low yield without calling it a crawler bug", () => {
    const row: ProviderEffectivenessRow = {
      provider: "udemy",
      queriesEnabled: 3,
      querySuccesses: 10,
      queryFailures: 0,
      failureRate: 0,
      candidatesTotal: 40,
      candidatesApproved: 1,
      candidatesDuplicate: 35,
      candidatesInvalid: 4,
      duplicateRate: 0.875,
      publishYield: 0.025,
      publishedCourses: 2,
      daysSinceLastQuerySuccess: 1,
      health: "LOW_YIELD",
      recommendation: "reduce",
    };
    const diag = diagnoseProvider(row);
    expect(diag.primaryFailureClass).toBe("DUPLICATE_HEAVY");
  });
});

describe("M27 yield metrics", () => {
  it("computes fixture yields without inventing approval rates", () => {
    const metrics = computeYieldMetrics(YIELD_FIXTURE_SAMPLES[0]!);
    expect(metrics.uniqueYield).toBeCloseTo(0.5);
    expect(metrics.approvedRate).toBeNull();
    expect(deltaRate(0.1, 0.25)).toBeCloseTo(0.15);
  });
});

describe("M27 gap closure + snapshot delta", () => {
  it("derives OPEN → CANDIDATES_FOUND → COVERAGE_IMPROVED", () => {
    expect(
      deriveGapClosureStatus({
        coverage: "EMPTY",
        demandBand: "HIGH",
        openCandidates: 0,
        hasDryRunPlan: false,
        publishedEligible: 0,
      }),
    ).toBe("OPEN");
    expect(
      deriveGapClosureStatus({
        coverage: "EMPTY",
        demandBand: "HIGH",
        openCandidates: 3,
        hasDryRunPlan: true,
        publishedEligible: 0,
      }),
    ).toBe("CANDIDATES_FOUND");
    expect(
      deriveGapClosureStatus({
        coverage: "HEALTHY",
        demandBand: "HIGH",
        openCandidates: 0,
        hasDryRunPlan: true,
        publishedEligible: 8,
        publishedEligibleAtOpen: 0,
      }),
    ).toBe("COVERAGE_IMPROVED");
  });

  it("diffs T0/T1 snapshots", () => {
    const base: CatalogGrowthSnapshot = {
      label: "T0",
      capturedAt: "2026-01-01T00:00:00.000Z",
      publishedEligibleEstimate: 10,
      publishedCourses: 12,
      emptyCategories: 5,
      thinCategories: 4,
      healthyCategories: 3,
      strongCategories: 1,
      zeroResultSearches30d: 20,
      lowResultSearches30d: 5,
      freshVerificationRate30d: 0.5,
      imageCoverageRate: 0.7,
      providerDiversityPublished: 4,
      providersHealthy: 3,
      providersProblem: 2,
    };
    const t1 = {
      ...base,
      label: "T1" as const,
      publishedEligibleEstimate: 18,
      emptyCategories: 2,
      thinCategories: 3,
      zeroResultSearches30d: 12,
    };
    expect(diffCatalogSnapshots(base, t1)).toEqual({
      publishedEligibleDelta: 8,
      emptyClosed: 3,
      thinClosed: 1,
      zeroResultDelta: -8,
    });
  });
});
