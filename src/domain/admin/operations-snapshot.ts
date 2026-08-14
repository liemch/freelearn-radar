import { count, desc, eq, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  apiUsageLog,
  courses,
  discoveryQueries,
  type AdminAuditLog,
} from "@/db/schema";
import { listRecentAuditLogs } from "@/db/repositories/audit-log-repository";

/**
 * `unknown` is a first-class outcome, not a failure to compute.
 *
 * Project plan §32 is explicit that a subsystem must not be reported healthy
 * merely because nothing has gone visibly wrong. Several subsystems here record
 * no success signal at all, so they report `unknown` permanently until one is
 * added — which is the honest answer, and also the pressure to add one.
 */
export type HealthState = "healthy" | "degraded" | "failed" | "unknown";

export type SubsystemHealth = {
  state: HealthState;
  /** Timestamp the state was derived from, when there is one. */
  observedAt: Date | null;
  /** Extra numeric context, e.g. error counts from the last run. */
  detail?: string;
};

export type DiscoveryRunRecord = {
  id: string;
  at: Date;
  actorType: AdminAuditLog["actorType"];
  scope: string;
  queriesProcessed: number | null;
  created: number | null;
  duplicates: number | null;
  invalid: number | null;
  errors: number | null;
};

export type OperationsSnapshot = {
  discovery: SubsystemHealth;
  verification: SubsystemHealth;
  monitor: SubsystemHealth;
  queries: { total: number; enabled: number; dueNow: number };
  latestRun: DiscoveryRunRecord | null;
  recentRuns: DiscoveryRunRecord[];
};

/** A subsystem that has not reported in two days is not working, whatever it last said. */
const STALE_MS = 48 * 60 * 60 * 1000;
/** Verification is a slower loop; a week is the point at which it is a problem. */
const VERIFICATION_STALE_MS = 7 * 24 * 60 * 60 * 1000;

function readNumber(source: unknown, key: string): number | null {
  if (!source || typeof source !== "object") return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function toRunRecord(row: AdminAuditLog): DiscoveryRunRecord {
  return {
    id: row.id,
    at: row.createdAt,
    actorType: row.actorType,
    scope: row.entityId,
    queriesProcessed: readNumber(row.afterJson, "queriesProcessed"),
    created: readNumber(row.afterJson, "created"),
    duplicates: readNumber(row.afterJson, "duplicates"),
    invalid: readNumber(row.afterJson, "invalid"),
    errors: readNumber(row.afterJson, "errors"),
  };
}

function ageState(
  at: Date | null,
  now: Date,
  staleAfterMs: number,
): HealthState {
  if (!at) return "unknown";
  return now.getTime() - at.getTime() <= staleAfterMs ? "healthy" : "degraded";
}

/**
 * Everything an operator needs to answer "is the pipeline running?" — assembled
 * from signals the system already writes: the audit log, per-query scheduling
 * columns, course verification timestamps, and the monitor's usage log.
 */
export async function getOperationsSnapshot(
  db: Db,
  options: { now?: Date; runHistoryLimit?: number } = {},
): Promise<OperationsSnapshot> {
  const now = options.now ?? new Date();

  const [runRows, queryStats, verificationRow, monitorRow] = await Promise.all([
    listRecentAuditLogs(db, {
      action: "DISCOVERY_RUN",
      limit: options.runHistoryLimit ?? 10,
    }),
    db
      .select({
        total: count(),
        enabled: sql<number>`count(*) filter (where ${discoveryQueries.enabled})::int`,
        dueNow: sql<number>`count(*) filter (where ${discoveryQueries.enabled} and (${discoveryQueries.nextRunAt} is null or ${discoveryQueries.nextRunAt} <= now()))::int`,
      })
      .from(discoveryQueries),
    db
      .select({ lastVerifiedAt: sql<Date | null>`max(${courses.lastVerifiedAt})` })
      .from(courses)
      .where(eq(courses.status, "PUBLISHED")),
    db
      .select({ createdAt: apiUsageLog.createdAt, ok: apiUsageLog.ok })
      .from(apiUsageLog)
      .where(eq(apiUsageLog.kind, "monitor_fetch"))
      .orderBy(desc(apiUsageLog.createdAt))
      .limit(1),
  ]);

  const runs = runRows.map(toRunRecord);
  const latestRun = runs[0] ?? null;

  const discovery: SubsystemHealth = latestRun
    ? {
        state:
          (latestRun.errors ?? 0) > 0
            ? "degraded"
            : ageState(latestRun.at, now, STALE_MS),
        observedAt: latestRun.at,
        detail:
          latestRun.errors != null && latestRun.errors > 0
            ? String(latestRun.errors)
            : undefined,
      }
    : { state: "unknown", observedAt: null };

  const lastVerifiedAt = verificationRow[0]?.lastVerifiedAt ?? null;
  const verification: SubsystemHealth = {
    state: ageState(lastVerifiedAt, now, VERIFICATION_STALE_MS),
    observedAt: lastVerifiedAt,
  };

  const monitorLast = monitorRow[0] ?? null;
  const monitor: SubsystemHealth = monitorLast
    ? {
        state:
          monitorLast.ok === false
            ? "failed"
            : ageState(monitorLast.createdAt, now, STALE_MS),
        observedAt: monitorLast.createdAt,
      }
    : { state: "unknown", observedAt: null };

  return {
    discovery,
    verification,
    monitor,
    queries: {
      total: queryStats[0]?.total ?? 0,
      enabled: queryStats[0]?.enabled ?? 0,
      dueNow: queryStats[0]?.dueNow ?? 0,
    },
    latestRun,
    recentRuns: runs,
  };
}

/** Recent state changes across the whole system, for the dashboard activity feed. */
export async function listRecentActivity(
  db: Db,
  limit = 8,
): Promise<AdminAuditLog[]> {
  return listRecentAuditLogs(db, { limit });
}

