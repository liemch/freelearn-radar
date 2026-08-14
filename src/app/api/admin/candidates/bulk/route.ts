import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { writeAuditLog } from "@/domain/admin/audit-log";
import {
  approveCandidate,
  rejectCandidate,
} from "@/domain/candidate/approve-candidate";
import { getSession } from "@/lib/auth/guards";
import { assertEditor, authzResponse } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

const bodySchema = z.object({
  action: z.enum(["reject", "approve"]),
  ids: z.array(z.string().uuid()).min(1).max(50),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    assertEditor(session);

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { action, ids, reason } = parsed.data;
    const db = getDb();
    const requestId = crypto.randomUUID();
    const results: Array<{
      id: string;
      ok: boolean;
      error?: string;
    }> = [];

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "BULK_ACTION",
      entityType: "candidate",
      entityId: requestId,
      after: { action, ids, count: ids.length },
      reason: reason ?? null,
      requestId,
    });

    for (const id of ids) {
      try {
        if (action === "approve") {
          await approveCandidate(db, {
            candidateId: id,
            actorId: session.userId,
            requestId,
          });
        } else {
          await rejectCandidate(db, id, reason ?? "Bulk rejected by admin", {
            actorId: session.userId,
            requestId,
          });
        }
        results.push({ id, ok: true });
      } catch (error) {
        results.push({
          id,
          ok: false,
          error: error instanceof Error ? error.message : "Action failed",
        });
      }
    }

    return NextResponse.json({
      requestId,
      action,
      results,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;

    logger.error("admin.candidates.bulk", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk action failed" },
      { status: 400 },
    );
  }
}
