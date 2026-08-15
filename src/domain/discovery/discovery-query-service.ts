import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import { coverageThresholds } from "@/config/coverage-thresholds";
import type { Db } from "@/db";
import {
  discoveryQueries,
  type DiscoveryQuery,
} from "@/db/schema";
import { writeAuditLog } from "@/domain/admin/audit-log";
import {
  coverageStatusRank,
  discoveryPriorityScore,
  nextRunHoursForJunkRate,
  type CoverageStatus,
} from "@/domain/coverage/classify-coverage";
import { getServerEnv } from "@/lib/env";

/**
 * M21.2 discovery coverage budget.
 *
 * Ordering due queries globally makes each category's share of a run equal to
 * its share of seeded queries, which is how Tech ends up dominating discovery
 * even when the taxonomy looks broad (§124.1). Interleaving one query per
 * category per round caps any single category's share of a run at
 * `1 / categoryCount`, so a thinly seeded domain still gets picked up.
 *
 * This deliberately does not enforce equal course counts — §124.2 asks only
 * that important categories are not starved.
 */
export function interleaveByCategory<T extends { category: string | null }>(
  queries: T[],
  limit: number,
  /**
   * Optional M26 coverage map: EMPTY/THIN categories lead each interleave
   * round without stopping discovery for HEALTHY/STRONG ones.
   */
  coverageByCategory?: Map<string, CoverageStatus>,
): T[] {
  if (limit <= 0) return [];

  const buckets = new Map<string, T[]>();
  for (const query of queries) {
    const key = query.category ?? "__uncategorized__";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(query);
    else buckets.set(key, [query]);
  }

  // Insertion order follows the incoming ordering (least-recently-run first),
  // so the category whose queries are most overdue still leads each round.
  // M26: when coverage is known, prefer EMPTY/THIN buckets first.
  let order = [...buckets.keys()];
  if (coverageByCategory && coverageByCategory.size > 0) {
    order = order.sort((a, b) => {
      const ca = coverageByCategory.get(a) ?? "HEALTHY";
      const cb = coverageByCategory.get(b) ?? "HEALTHY";
      const scoreA = discoveryPriorityScore({
        coverage: ca,
        zeroResultDemand: 0,
        recentYield: null,
      });
      const scoreB = discoveryPriorityScore({
        coverage: cb,
        zeroResultDemand: 0,
        recentYield: null,
      });
      if (scoreB !== scoreA) return scoreB - scoreA;
      return coverageStatusRank(ca) - coverageStatusRank(cb);
    });
  }

  const selected: T[] = [];
  let round = 0;

  while (selected.length < limit) {
    let tookAny = false;
    for (const key of order) {
      const bucket = buckets.get(key)!;
      const candidate = bucket[round];
      if (!candidate) continue;
      selected.push(candidate);
      tookAny = true;
      if (selected.length >= limit) break;
    }
    if (!tookAny) break;
    round += 1;
  }

  return selected;
}

export async function listDueDiscoveryQueries(
  db: Db,
  limit?: number,
  scope?: {
    provider?: string;
    category?: string;
    /** Manual admin runs bypass the 24h cooldown set by the last successful run. */
    ignoreSchedule?: boolean;
  },
): Promise<DiscoveryQuery[]> {
  const queryLimit = limit ?? getServerEnv().DISCOVERY_QUERY_LIMIT;
  const now = new Date();

  const conditions = [eq(discoveryQueries.enabled, true)];

  if (!scope?.ignoreSchedule) {
    conditions.push(
      or(
        isNull(discoveryQueries.nextRunAt),
        lte(discoveryQueries.nextRunAt, now),
      )!,
    );
  }

  if (scope?.provider) {
    conditions.push(eq(discoveryQueries.provider, scope.provider));
  }

  if (scope?.category) {
    conditions.push(eq(discoveryQueries.category, scope.category));
  }

  // Over-fetch so the interleave has candidates from thin categories to draw
  // on; a single category's queries would otherwise fill the whole window.
  const pool = await db
    .select()
    .from(discoveryQueries)
    .where(and(...conditions))
    .orderBy(
      sql`${discoveryQueries.lastRunAt} ASC NULLS FIRST`,
      asc(discoveryQueries.successCount),
    )
    .limit(Math.max(queryLimit * 4, queryLimit));

  // An explicit category scope is already the operator's chosen budget.
  if (scope?.category) {
    return pool.slice(0, queryLimit);
  }

  let coverageByCategory: Map<string, CoverageStatus> | undefined;
  try {
    const { listCategoryCoverage } = await import(
      "@/domain/coverage/catalog-metrics"
    );
    const rows = await listCategoryCoverage(db);
    coverageByCategory = new Map(
      rows.map((row) => [row.categorySlug, row.coverage]),
    );
  } catch {
    coverageByCategory = undefined;
  }

  return interleaveByCategory(pool, queryLimit, coverageByCategory);
}

export async function markDiscoveryQuerySuccess(
  db: Db,
  id: string,
  options?: {
    /** 0–1 share of duplicate+invalid among results this run. */
    junkRate?: number;
  },
): Promise<void> {
  const junkRate =
    options?.junkRate != null
      ? Math.min(1, Math.max(0, options.junkRate))
      : null;
  const hours =
    junkRate != null
      ? nextRunHoursForJunkRate(junkRate)
      : coverageThresholds.schedule.successDefaultHours;

  await db
    .update(discoveryQueries)
    .set({
      lastRunAt: new Date(),
      nextRunAt: new Date(Date.now() + hours * 60 * 60 * 1000),
      successCount: sql`${discoveryQueries.successCount} + 1`,
      ...(junkRate != null
        ? {
            junkRate: junkRate.toFixed(4),
            lastJunkReviewAt: new Date(),
          }
        : {}),
    })
    .where(eq(discoveryQueries.id, id));

  await writeAuditLog(db, {
    actorType: "CRON",
    action: "DISCOVERY_QUERY_SUCCEEDED",
    entityType: "discovery_query",
    entityId: id,
    after: { nextRunInHours: hours, junkRate },
  });
}

export async function markDiscoveryQueryFailure(
  db: Db,
  id: string,
): Promise<void> {
  await db
    .update(discoveryQueries)
    .set({
      lastRunAt: new Date(),
      nextRunAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      failureCount: sql`${discoveryQueries.failureCount} + 1`,
    })
    .where(eq(discoveryQueries.id, id));

  await writeAuditLog(db, {
    actorType: "CRON",
    action: "DISCOVERY_QUERY_FAILED",
    entityType: "discovery_query",
    entityId: id,
    after: { nextRunInHours: 6 },
  });
}

export { listEnabledDiscoveryQueries } from "@/db/repositories/discovery-query-repository";
