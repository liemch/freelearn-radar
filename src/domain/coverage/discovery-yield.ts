/**
 * Repeatable discovery yield math (M27).
 * Human approval is never fabricated.
 */
export type YieldSample = {
  provider: string;
  query: string;
  rawResults: number;
  validCandidates: number;
  newUnique: number;
  duplicates: number;
  fetchAttempted: number;
  fetchSuccess: number;
  analyzed: number;
  analysisSuccess: number;
  /** Only when humans actually approved in the sample window. */
  approved: number | null;
};

export type YieldMetrics = {
  uniqueYield: number | null;
  validCandidateRate: number | null;
  duplicateRate: number | null;
  fetchSuccessRate: number | null;
  analysisSuccessRate: number | null;
  eligibleRateNote: string;
  approvedRate: number | null;
};

export function computeYieldMetrics(sample: YieldSample): YieldMetrics {
  const raw = sample.rawResults;
  const valid = sample.validCandidates;
  return {
    uniqueYield: raw > 0 ? sample.newUnique / raw : null,
    validCandidateRate: raw > 0 ? valid / raw : null,
    duplicateRate: raw > 0 ? sample.duplicates / raw : null,
    fetchSuccessRate:
      sample.fetchAttempted > 0
        ? sample.fetchSuccess / sample.fetchAttempted
        : null,
    analysisSuccessRate:
      sample.analyzed > 0 ? sample.analysisSuccess / sample.analyzed : null,
    eligibleRateNote:
      "Truth eligibility is decided at human approve — not inferred from discovery.",
    approvedRate:
      sample.approved != null && valid > 0 ? sample.approved / valid : null,
  };
}

export function deltaRate(
  before: number | null,
  after: number | null,
): number | null {
  if (before == null || after == null) return null;
  return after - before;
}

/** Fixture samples for unit/regression — not live provider traffic. */
export const YIELD_FIXTURE_SAMPLES: YieldSample[] = [
  {
    provider: "coursera",
    query: "site:coursera.org/learn python audit for free",
    rawResults: 10,
    validCandidates: 6,
    newUnique: 5,
    duplicates: 3,
    fetchAttempted: 5,
    fetchSuccess: 5,
    analyzed: 5,
    analysisSuccess: 4,
    approved: null,
  },
  {
    provider: "udemy",
    query: "site:udemy.com/course python coupon 100% off",
    rawResults: 10,
    validCandidates: 2,
    newUnique: 1,
    duplicates: 7,
    fetchAttempted: 1,
    fetchSuccess: 1,
    analyzed: 1,
    analysisSuccess: 1,
    approved: null,
  },
];
