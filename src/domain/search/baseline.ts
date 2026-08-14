import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { searchQueries } from "@/db/schema";

export type SearchBaselineReport = {
  windowDays: number;
  since: string;
  totalSearches: number;
  zeroResultCount: number;
  zeroResultRate: number | null;
  unmetIntentCount: number;
  unmetIntentRate: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  distinctQueryHashes: number;
  topQueries: Array<{
    queryHash: string;
    normalizedQuery: string | null;
    count: number;
    zeroResultShare: number;
  }>;
  languageDistribution: Array<{ language: string; count: number }>;
  filterUsage: {
    withTextQuery: number;
    withAnyFilter: number;
  };
  note: string;
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx] ?? null;
}

export async function buildSearchBaseline(
  db: Db,
  options: { windowDays?: number; topN?: number } = {},
): Promise<SearchBaselineReport> {
  const windowDays = options.windowDays ?? 30;
  const topN = options.topN ?? 100;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      zero: sql<number>`count(*) filter (where ${searchQueries.zeroResult})::int`,
      unmet: sql<number>`count(*) filter (where ${searchQueries.unmetIntent})::int`,
      withText: sql<number>`count(*) filter (where ${searchQueries.normalizedQuery} is not null)::int`,
      withFilter: sql<number>`count(*) filter (where ${searchQueries.filtersJson} is not null)::int`,
      distinctHashes: sql<number>`count(distinct ${searchQueries.queryHash})::int`,
    })
    .from(searchQueries)
    .where(gte(searchQueries.createdAt, since));

  const latencyRows = await db
    .select({ latencyMs: searchQueries.latencyMs })
    .from(searchQueries)
    .where(
      and(
        gte(searchQueries.createdAt, since),
        sql`${searchQueries.latencyMs} is not null`,
      ),
    );

  const latencies = latencyRows
    .map((r) => r.latencyMs)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);

  const topQueries = await db
    .select({
      queryHash: searchQueries.queryHash,
      normalizedQuery: sql<string | null>`min(${searchQueries.normalizedQuery})`,
      count: sql<number>`count(*)::int`,
      zeroCount: sql<number>`count(*) filter (where ${searchQueries.zeroResult})::int`,
    })
    .from(searchQueries)
    .where(gte(searchQueries.createdAt, since))
    .groupBy(searchQueries.queryHash)
    .orderBy(desc(sql`count(*)`))
    .limit(topN);

  const languageDistribution = await db
    .select({
      language: searchQueries.queryLanguage,
      count: sql<number>`count(*)::int`,
    })
    .from(searchQueries)
    .where(gte(searchQueries.createdAt, since))
    .groupBy(searchQueries.queryLanguage)
    .orderBy(desc(sql`count(*)`));

  const total = totals?.total ?? 0;
  const zero = totals?.zero ?? 0;
  const unmet = totals?.unmet ?? 0;

  return {
    windowDays,
    since: since.toISOString(),
    totalSearches: total,
    zeroResultCount: zero,
    zeroResultRate: total > 0 ? zero / total : null,
    unmetIntentCount: unmet,
    unmetIntentRate: total > 0 ? unmet / total : null,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    distinctQueryHashes: totals?.distinctHashes ?? 0,
    topQueries: topQueries.map((row) => ({
      queryHash: row.queryHash,
      normalizedQuery: row.normalizedQuery,
      count: row.count,
      zeroResultShare: row.count > 0 ? row.zeroCount / row.count : 0,
    })),
    languageDistribution: languageDistribution.map((row) => ({
      language: row.language,
      count: row.count,
    })),
    filterUsage: {
      withTextQuery: totals?.withText ?? 0,
      withAnyFilter: totals?.withFilter ?? 0,
    },
    note:
      "Session share, detail CTR, and outbound CTR from search require product " +
      "session stitching not yet wired; those §86.2 fields stay unknown until " +
      "click attribution lands.",
  };
}

export async function sampleZeroResultQueries(
  db: Db,
  options: { windowDays?: number; limit?: number } = {},
) {
  const windowDays = options.windowDays ?? 90;
  const limit = options.limit ?? 150;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  return db
    .select({
      queryHash: searchQueries.queryHash,
      normalizedQuery: sql<string | null>`min(${searchQueries.normalizedQuery})`,
      count: sql<number>`count(*)::int`,
      lastSeen: sql<string>`max(${searchQueries.createdAt})`,
    })
    .from(searchQueries)
    .where(
      and(
        gte(searchQueries.createdAt, since),
        eq(searchQueries.zeroResult, true),
      ),
    )
    .groupBy(searchQueries.queryHash)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}
