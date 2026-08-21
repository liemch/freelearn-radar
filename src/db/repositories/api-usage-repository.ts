import { desc, gte, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { apiUsageLog, type NewApiUsageLog } from "@/db/schema";

export type ApiUsageInsert = Pick<
  NewApiUsageLog,
  | "kind"
  | "provider"
  | "operation"
  | "courseId"
  | "domain"
  | "httpStatus"
  | "ok"
  | "latencyMs"
  | "units"
  | "costUsd"
  | "workerVersion"
  | "error"
  | "metaJson"
>;

export async function insertApiUsage(
  db: Db,
  input: ApiUsageInsert,
): Promise<void> {
  await db.insert(apiUsageLog).values(input);
}

export type ApiUsageTotals = {
  kind: string;
  provider: string | null;
  calls: number;
  failures: number;
  units: number;
  avgLatencyMs: number | null;
};

/**
 * Per-kind spend since `since`. This is the budget view §77 asks for: every
 * paid outbound call lands in one table so cost is readable without leaving
 * the app.
 */
export async function summarizeApiUsage(
  db: Db,
  since: Date,
): Promise<ApiUsageTotals[]> {
  const rows = await db
    .select({
      kind: apiUsageLog.kind,
      provider: apiUsageLog.provider,
      calls: sql<number>`count(*)::int`,
      failures: sql<number>`count(*) filter (where ${apiUsageLog.ok} is false)::int`,
      units: sql<number>`coalesce(sum(${apiUsageLog.units}), 0)::int`,
      avgLatencyMs: sql<number | null>`round(avg(${apiUsageLog.latencyMs}))::int`,
    })
    .from(apiUsageLog)
    .where(gte(apiUsageLog.createdAt, since))
    .groupBy(apiUsageLog.kind, apiUsageLog.provider)
    .orderBy(desc(sql`count(*)`));

  return rows;
}
