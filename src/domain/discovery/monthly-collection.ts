import { rankCourses } from "@/domain/ranking/ranking";
import type { Course } from "@/db/schema";

export type MonthlyCollectionResult<T extends Course> = {
  items: Array<T & { rankingScore: number }>;
  mode: "in_month" | "overall_fallback";
  inMonthCount: number;
};

/**
 * Deterministic monthly collection.
 * Prefer courses published in the month; rank by trust-aware ranking.
 * If empty, fall back to overall top ranked (explicit mode for UI honesty).
 * Limit keeps pages useful, not thin dumps.
 */
export function selectMonthlyCollection<T extends Course>(
  published: T[],
  year: number,
  month: number,
  limit = 20,
  now = new Date(),
): MonthlyCollectionResult<T> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const inMonth = published.filter((course) => {
    if (!course.publishedAt) return false;
    const ts = course.publishedAt.getTime();
    return ts >= start.getTime() && ts < end.getTime();
  });

  if (inMonth.length > 0) {
    return {
      items: rankCourses(inMonth, now).slice(0, limit),
      mode: "in_month",
      inMonthCount: inMonth.length,
    };
  }

  return {
    items: rankCourses(published, now).slice(0, limit),
    mode: "overall_fallback",
    inMonthCount: 0,
  };
}

export function currentBestPath(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `/best/${year}/${month}`;
}
