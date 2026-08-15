import type { ProviderEffectivenessRow } from "@/domain/coverage/provider-effectiveness";
import { classifyDiscoveryFailureReason } from "@/domain/coverage/failure-reasons";

export type ProviderFailureClass =
  | "NETWORK"
  | "RATE_LIMIT"
  | "HTML_CHANGED"
  | "API_CHANGED"
  | "PARSER"
  | "AUTH"
  | "ROBOTS_POLICY"
  | "DUPLICATE_HEAVY"
  | "LOW_FREE_CONTENT"
  | "LOW_YIELD_BY_NATURE"
  | "VERIFICATION_FAILURE"
  | "NO_COURSE_SIGNAL"
  | "OTHER";

export type ProviderDiagnostic = {
  provider: string;
  health: ProviderEffectivenessRow["health"];
  failureRate: number | null;
  publishYield: number | null;
  duplicateRate: number | null;
  daysSinceLastQuerySuccess: number | null;
  primaryFailureClass: ProviderFailureClass;
  recommendedAction: string;
  evidence: string[];
};

/**
 * Root-cause classification from operational signals (no secret leakage).
 * Low free content is not treated as a crawler bug.
 */
export function diagnoseProvider(
  row: ProviderEffectivenessRow,
  recentRejectionReasons: string[] = [],
): ProviderDiagnostic {
  const evidence: string[] = [];
  if (row.failureRate != null) {
    evidence.push(`query_failure_rate=${(row.failureRate * 100).toFixed(0)}%`);
  }
  if (row.duplicateRate != null) {
    evidence.push(`duplicate_rate=${(row.duplicateRate * 100).toFixed(0)}%`);
  }
  if (row.publishYield != null) {
    evidence.push(`approve_yield=${(row.publishYield * 100).toFixed(0)}%`);
  }
  if (row.daysSinceLastQuerySuccess != null) {
    evidence.push(`days_since_success=${row.daysSinceLastQuerySuccess}`);
  }

  const mapped = recentRejectionReasons.map((r) =>
    classifyDiscoveryFailureReason(r),
  );
  const noCourse = mapped.filter((r) => r === "NO_COURSE_SIGNAL").length;
  const fetchFail = mapped.filter((r) => r === "FETCH_FAILED").length;
  const dup = mapped.filter((r) => r === "DUPLICATE").length;

  let primaryFailureClass: ProviderFailureClass = "OTHER";
  let recommendedAction = row.recommendation;

  if (row.health === "FAILING" && (row.failureRate ?? 0) >= 0.4) {
    if (fetchFail > noCourse && fetchFail > 0) {
      primaryFailureClass = "NETWORK";
      recommendedAction =
        "Kiểm tra timeout / rate limit / domain filter — không bypass robots.";
    } else {
      primaryFailureClass = "API_CHANGED";
      recommendedAction =
        "Kiểm tra search provider + query template; không hạ Truth.";
    }
  } else if (row.health === "LOW_YIELD") {
    if ((row.duplicateRate ?? 0) >= 0.75) {
      primaryFailureClass = "DUPLICATE_HEAVY";
      recommendedAction = "Giảm tần suất / đổi query — không rewrite crawler.";
    } else if (noCourse >= dup && noCourse > 0) {
      primaryFailureClass = "NO_COURSE_SIGNAL";
      recommendedAction = "Siết URL shape / query; có thể LOW_YIELD_BY_NATURE.";
    } else if ((row.publishYield ?? 1) < 0.05 && row.candidatesTotal >= 10) {
      primaryFailureClass = "LOW_YIELD_BY_NATURE";
      recommendedAction =
        "Provider ít free content đạt Truth — giảm priority discovery.";
    } else {
      primaryFailureClass = "LOW_FREE_CONTENT";
      recommendedAction = "Giảm priority; giữ query floor tối thiểu.";
    }
  } else if (row.health === "DEGRADED") {
    primaryFailureClass = "NETWORK";
    recommendedAction =
      "Chạy thủ công scoped để xác nhận; kiểm tra cron/Hobby schedule.";
  } else if (row.health === "HEALTHY") {
    primaryFailureClass = "OTHER";
    recommendedAction = "Giữ cadence hiện tại.";
  }

  return {
    provider: row.provider,
    health: row.health,
    failureRate: row.failureRate,
    publishYield: row.publishYield,
    duplicateRate: row.duplicateRate,
    daysSinceLastQuerySuccess: row.daysSinceLastQuerySuccess,
    primaryFailureClass,
    recommendedAction,
    evidence,
  };
}

export function diagnoseProviders(
  rows: ProviderEffectivenessRow[],
): ProviderDiagnostic[] {
  return rows
    .filter((r) =>
      ["FAILING", "DEGRADED", "LOW_YIELD"].includes(r.health),
    )
    .map((r) => diagnoseProvider(r))
    .sort((a, b) => a.provider.localeCompare(b.provider));
}
