import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  discoveryQueries,
  type DiscoveryQuery,
} from "@/db/schema";
import { writeAuditLog } from "@/domain/admin/audit-log";
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
  const order = [...buckets.keys()];
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

  return interleaveByCategory(pool, queryLimit);
}

export async function markDiscoveryQuerySuccess(
  db: Db,
  id: string,
): Promise<void> {
  await db
    .update(discoveryQueries)
    .set({
      lastRunAt: new Date(),
      nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      successCount: sql`${discoveryQueries.successCount} + 1`,
    })
    .where(eq(discoveryQueries.id, id));

  await writeAuditLog(db, {
    actorType: "CRON",
    action: "DISCOVERY_QUERY_SUCCEEDED",
    entityType: "discovery_query",
    entityId: id,
    after: { nextRunInHours: 24 },
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
