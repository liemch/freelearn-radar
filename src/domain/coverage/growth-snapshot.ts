import type { Db } from "@/db";
import {
  getCatalogBaseline,
  listCategoryCoverage,
  summarizeCoverageHealth,
} from "@/domain/coverage/catalog-metrics";
import { getUnmetIntentSummary } from "@/domain/coverage/unmet-intent";
import { listProviderEffectiveness } from "@/domain/coverage/provider-effectiveness";

/**
 * Point-in-time catalog health snapshot for T0/T1 comparison.
 * Does not mutate data. T1 requires an operator discovery+review cycle.
 */
export type CatalogGrowthSnapshot = {
  label: "T0" | "T1" | string;
  capturedAt: string;
  publishedEligibleEstimate: number;
  publishedCourses: number;
  emptyCategories: number;
  thinCategories: number;
  healthyCategories: number;
  strongCategories: number;
  zeroResultSearches30d: number;
  lowResultSearches30d: number;
  freshVerificationRate30d: number | null;
  imageCoverageRate: number | null;
  providerDiversityPublished: number;
  providersHealthy: number;
  providersProblem: number;
};

export async function captureCatalogGrowthSnapshot(
  db: Db,
  label: CatalogGrowthSnapshot["label"] = "T0",
): Promise<CatalogGrowthSnapshot> {
  const [baseline, categories, demand, providers] = await Promise.all([
    getCatalogBaseline(db),
    listCategoryCoverage(db),
    getUnmetIntentSummary(db, { windowDays: 30, topN: 20 }),
    listProviderEffectiveness(db),
  ]);

  const health = summarizeCoverageHealth(categories);
  const publishedEligibleEstimate = categories.reduce(
    (sum, row) => sum + row.publishedEligible,
    0,
  );
  const providerDiversityPublished = providers.filter(
    (p) => p.publishedCourses > 0,
  ).length;

  return {
    label,
    capturedAt: new Date().toISOString(),
    publishedEligibleEstimate,
    publishedCourses: baseline.publishedCourses,
    emptyCategories: health.empty,
    thinCategories: health.thin,
    healthyCategories: health.healthy,
    strongCategories: health.strong,
    zeroResultSearches30d: demand.zeroResultSearches,
    lowResultSearches30d: demand.lowResultSearches,
    freshVerificationRate30d: baseline.freshVerificationRate30d,
    imageCoverageRate: baseline.imageCoverageRate,
    providerDiversityPublished,
    providersHealthy: providers.filter((p) => p.health === "HEALTHY").length,
    providersProblem: providers.filter((p) =>
      ["FAILING", "DEGRADED", "LOW_YIELD"].includes(p.health),
    ).length,
  };
}

export type SnapshotDelta = {
  publishedEligibleDelta: number;
  emptyClosed: number;
  thinClosed: number;
  zeroResultDelta: number;
};

export function diffCatalogSnapshots(
  t0: CatalogGrowthSnapshot,
  t1: CatalogGrowthSnapshot,
): SnapshotDelta {
  return {
    publishedEligibleDelta:
      t1.publishedEligibleEstimate - t0.publishedEligibleEstimate,
    emptyClosed: t0.emptyCategories - t1.emptyCategories,
    thinClosed: t0.thinCategories - t1.thinCategories,
    zeroResultDelta: t1.zeroResultSearches30d - t0.zeroResultSearches30d,
  };
}
