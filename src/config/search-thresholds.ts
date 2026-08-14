/**
 * Provisional search gate thresholds from project-plan-v1_3.md §85.
 * Final numbers are locked after M20.0 baseline + Intent Diagnosis.
 * Bump `version` when any threshold changes.
 */
export const SEARCH_THRESHOLDS_VERSION = "provisional-m20.0-2026-08-14";

export const searchThresholds = {
  version: SEARCH_THRESHOLDS_VERSION,
  ndcgAt10HybridVsLexicalRelative: 0.15,
  precisionAt5Hybrid: 0.6,
  exactTitleSuccess: 0.98,
  exactTitleRegressionPp: 0.01,
  viNdcgAt10VsEnFactor: 0.8,
  searchP95Ms: 600,
  semanticPathTimeoutMs: 400,
  vectorQueryTimeoutMs: 250,
  queryEmbeddingCacheHitRate: 0.6,
  semanticDegradedRate: 0.02,
  hardZeroResultRate: 0.03,
  unmetIntentRate: 0.08,
  intentParseSuccess: 0.95,
  fallbackToRawQueryRate: 0.05,
  nlIntentCallsPerDay: 2000,
  nlIntentCallsPerIpPerHour: 20,
  diversityCapSimilarCourses: 2,
  learningPathStepsMin: 3,
  learningPathStepsMax: 7,
  compareCoursesMax: 3,
  /** Reported at Gate B; not a hard numeric pass/fail here. */
  catalogGapShareOfZeroResult: "report-only" as const,
} as const;

export type SearchThresholds = typeof searchThresholds;
