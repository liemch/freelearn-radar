import { and, asc, inArray, lt } from "drizzle-orm";

import type { Db } from "@/db";
import { courseCandidates } from "@/db/schema";
import { writeAuditLog } from "@/domain/admin/audit-log";

const STALE_STATUSES = ["READY_FOR_REVIEW", "ANALYZED", "DISCOVERED"] as const;

export type ExpireStaleOptions = {
  /** Cap rows touched per call (cron should stay cheap). */
  limit?: number;
};

/**
 * Mark unreviewed candidates older than `olderThanDays` as EXPIRED_UNREVIEWED
 * so they leave the active review queue (M19 §79.5).
 */
export async function expireStaleCandidates(
  db: Db,
  olderThanDays = 30,
  options: ExpireStaleOptions = {},
): Promise<{ expired: number }> {
  const limit = options.limit ?? 100;
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const reason = `Expired unreviewed after ${olderThanDays} days`;

  const stale = await db
    .select({
      id: courseCandidates.id,
      discoveryStatus: courseCandidates.discoveryStatus,
    })
    .from(courseCandidates)
    .where(
      and(
        inArray(courseCandidates.discoveryStatus, [...STALE_STATUSES]),
        lt(courseCandidates.discoveredAt, cutoff),
      ),
    )
    .orderBy(asc(courseCandidates.discoveredAt))
    .limit(limit);

  if (stale.length === 0) {
    return { expired: 0 };
  }

  const ids = stale.map((row) => row.id);
  await db
    .update(courseCandidates)
    .set({
      discoveryStatus: "EXPIRED_UNREVIEWED",
      errorMessage: reason,
    })
    .where(inArray(courseCandidates.id, ids));

  for (const row of stale) {
    await writeAuditLog(db, {
      actorType: "CRON",
      action: "CANDIDATE_EXPIRE_UNREVIEWED",
      entityType: "candidate",
      entityId: row.id,
      before: { discoveryStatus: row.discoveryStatus },
      after: { discoveryStatus: "EXPIRED_UNREVIEWED" },
      reason,
    });
  }

  return { expired: stale.length };
}
