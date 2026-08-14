import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  discoveryQueries,
  type DiscoveryQuery,
} from "@/db/schema";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { getServerEnv } from "@/lib/env";

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

  return db
    .select()
    .from(discoveryQueries)
    .where(and(...conditions))
    .orderBy(
      sql`${discoveryQueries.lastRunAt} ASC NULLS FIRST`,
      asc(discoveryQueries.successCount),
    )
    .limit(queryLimit);
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
