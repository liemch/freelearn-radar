import { and, desc, gte, sql } from "drizzle-orm";

import { coverageThresholds } from "@/config/coverage-thresholds";
import type { Db } from "@/db";
import { searchQueries } from "@/db/schema";
import { classifySearchOutcome } from "@/domain/coverage/classify-coverage";

/**
 * Privacy-safe unmet demand: aggregates only.
 * No email, IP, fingerprint, or user id.
 */
export type UnmetIntentRow = {
  queryHash: string;
  normalizedQuery: string | null;
  searches: number;
  avgResultCount: number;
  outcome: "ZERO_RESULT" | "LOW_RESULT" | "HEALTHY_RESULT";
  lastSearchedAt: Date;
};

export type UnmetIntentSummary = {
  windowDays: number;
  totalSearches: number;
  zeroResultSearches: number;
  lowResultSearches: number;
  healthySearches: number;
  topUnmet: UnmetIntentRow[];
};

export function normalizeDemandQuery(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.+#-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getUnmetIntentSummary(
  db: Db,
  options: { windowDays?: number; topN?: number } = {},
): Promise<UnmetIntentSummary> {
  const windowDays = options.windowDays ?? 30;
  const topN = options.topN ?? 40;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const lowMax = coverageThresholds.lowResultMax;

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      zero: sql<number>`count(*) filter (where ${searchQueries.resultCount} <= 0)::int`,
      low: sql<number>`count(*) filter (where ${searchQueries.resultCount} > 0 and ${searchQueries.resultCount} <= ${lowMax})::int`,
      healthy: sql<number>`count(*) filter (where ${searchQueries.resultCount} > ${lowMax})::int`,
    })
    .from(searchQueries)
    .where(gte(searchQueries.createdAt, since));

  const grouped = await db
    .select({
      queryHash: searchQueries.queryHash,
      normalizedQuery: sql<string | null>`min(${searchQueries.normalizedQuery})`,
      searches: sql<number>`count(*)::int`,
      avgResultCount: sql<number>`avg(${searchQueries.resultCount})::float`,
      lastSearchedAt: sql<Date>`max(${searchQueries.createdAt})`,
    })
    .from(searchQueries)
    .where(
      and(
        gte(searchQueries.createdAt, since),
        sql`${searchQueries.resultCount} <= ${lowMax}`,
      ),
    )
    .groupBy(searchQueries.queryHash)
    .orderBy(desc(sql`count(*)`))
    .limit(topN);

  return {
    windowDays,
    totalSearches: totals?.total ?? 0,
    zeroResultSearches: totals?.zero ?? 0,
    lowResultSearches: totals?.low ?? 0,
    healthySearches: totals?.healthy ?? 0,
    topUnmet: grouped.map((row) => {
      const avg = Number(row.avgResultCount ?? 0);
      return {
        queryHash: row.queryHash,
        normalizedQuery: row.normalizedQuery,
        searches: row.searches,
        avgResultCount: avg,
        outcome: classifySearchOutcome(Math.round(avg)),
        lastSearchedAt: new Date(row.lastSearchedAt),
      };
    }),
  };
}
