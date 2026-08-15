import { desc, gte, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { courseCandidates, discoveryRejections } from "@/db/schema";
import { classifyDiscoveryFailureReason } from "@/domain/coverage/failure-reasons";

/**
 * Live funnel from actual candidate statuses + pre-ingest rejections.
 * Stages match repository terminology (not invented marketing names).
 */
export type DiscoveryFunnelSnapshot = {
  windowDays: number;
  discovered: number;
  fetched: number;
  analyzedOrReady: number;
  approved: number;
  rejected: number;
  invalid: number;
  duplicateStored: number;
  error: number;
  expiredUnreviewed: number;
  preIngestRejections: number;
  discoveryToApprovedRate: number | null;
  verificationNote: string;
};

export type FailureReasonRow = {
  reason: string;
  count: number;
};

export async function getDiscoveryFunnelSnapshot(
  db: Db,
  windowDays = 30,
): Promise<DiscoveryFunnelSnapshot> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [row] = await db
    .select({
      discovered: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'DISCOVERED')::int`,
      fetched: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'FETCHED')::int`,
      analyzedOrReady: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} in ('ANALYZED','READY_FOR_REVIEW'))::int`,
      approved: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'APPROVED')::int`,
      rejected: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'REJECTED')::int`,
      invalid: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'INVALID')::int`,
      duplicateStored: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'DUPLICATE')::int`,
      error: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'ERROR')::int`,
      expiredUnreviewed: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'EXPIRED_UNREVIEWED')::int`,
      totalInWindow: sql<number>`count(*) filter (where ${courseCandidates.discoveredAt} >= ${since})::int`,
      approvedInWindow: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'APPROVED' and ${courseCandidates.approvedAt} >= ${since})::int`,
    })
    .from(courseCandidates);

  const [rej] = await db
    .select({
      n: sql<number>`count(*) filter (where ${discoveryRejections.createdAt} >= ${since})::int`,
    })
    .from(discoveryRejections);

  const totalInWindow = row?.totalInWindow ?? 0;
  const approvedInWindow = row?.approvedInWindow ?? 0;

  return {
    windowDays,
    discovered: row?.discovered ?? 0,
    fetched: row?.fetched ?? 0,
    analyzedOrReady: row?.analyzedOrReady ?? 0,
    approved: row?.approved ?? 0,
    rejected: row?.rejected ?? 0,
    invalid: row?.invalid ?? 0,
    duplicateStored: row?.duplicateStored ?? 0,
    error: row?.error ?? 0,
    expiredUnreviewed: row?.expiredUnreviewed ?? 0,
    preIngestRejections: rej?.n ?? 0,
    discoveryToApprovedRate:
      totalInWindow > 0 ? approvedInWindow / totalInWindow : null,
    verificationNote:
      "Post-publish Truth runs on /api/cron/verify for PUBLISHED courses — not a candidate stage.",
  };
}

export async function listTopFailureReasons(
  db: Db,
  limit = 15,
): Promise<FailureReasonRow[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const candidateRows = await db
    .select({
      status: courseCandidates.discoveryStatus,
      errorMessage: courseCandidates.errorMessage,
      n: sql<number>`count(*)::int`,
    })
    .from(courseCandidates)
    .where(gte(courseCandidates.discoveredAt, since))
    .groupBy(courseCandidates.discoveryStatus, courseCandidates.errorMessage)
    .orderBy(desc(sql`count(*)`))
    .limit(80);

  const rejectionRows = await db
    .select({
      reason: discoveryRejections.reason,
      n: sql<number>`count(*)::int`,
    })
    .from(discoveryRejections)
    .where(gte(discoveryRejections.createdAt, since))
    .groupBy(discoveryRejections.reason)
    .orderBy(desc(sql`count(*)`))
    .limit(40);

  const counts = new Map<string, number>();

  for (const row of candidateRows) {
    if (
      !["REJECTED", "INVALID", "DUPLICATE", "ERROR", "EXPIRED_UNREVIEWED"].includes(
        row.status,
      )
    ) {
      continue;
    }
    const reason = classifyDiscoveryFailureReason(row.errorMessage, row.status);
    counts.set(reason, (counts.get(reason) ?? 0) + row.n);
  }

  for (const row of rejectionRows) {
    const reason = classifyDiscoveryFailureReason(row.reason);
    counts.set(reason, (counts.get(reason) ?? 0) + row.n);
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
