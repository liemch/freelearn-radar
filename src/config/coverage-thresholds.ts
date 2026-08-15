/**
 * M26 — Centralized catalog coverage thresholds.
 * Tune here; do not scatter magic numbers in UI.
 */
export const COVERAGE_THRESHOLDS_VERSION = "m26.0-2026-08-15";

export const coverageThresholds = {
  version: COVERAGE_THRESHOLDS_VERSION,
  /** Published eligible courses → EMPTY when ≤ this. */
  emptyMax: 0,
  /** Published eligible → THIN when ≤ this (and above empty). */
  thinMax: 4,
  /** Published eligible → HEALTHY when ≤ this (and above thin). */
  healthyMax: 14,
  /** Above healthyMax → STRONG. */
  /** Search result bands for unmet-intent ops. */
  lowResultMax: 2,
  /** Provider health (rolling signals). */
  provider: {
    /** Fetch/query failure rate above this → FAILING. */
    failingFailureRate: 0.4,
    /** Duplicate share of ingest outcomes above this → LOW_YIELD. */
    lowYieldDuplicateRate: 0.75,
    /** Days without a successful discovery signal → DEGRADED. */
    staleDays: 14,
    /** Minimum candidates before yield rates are meaningful. */
    minSample: 5,
  },
  /** Bounded adaptive scheduling (hours until nextRunAt). */
  schedule: {
    successDefaultHours: 24,
    highJunkHours: 48,
    mediumJunkHours: 36,
    highJunkRate: 0.8,
    mediumJunkRate: 0.5,
    failureBackoffHours: 6,
  },
} as const;

export type CoverageThresholds = typeof coverageThresholds;
