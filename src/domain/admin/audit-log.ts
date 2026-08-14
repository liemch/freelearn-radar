import type { Db } from "@/db";
import {
  insertAuditLog,
  listRecentAuditLogs,
  type AuditLogInsert,
} from "@/db/repositories/audit-log-repository";
import { logger } from "@/lib/logger";

export type WriteAuditLogInput = {
  actorType: AuditLogInsert["actorType"];
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  requestId?: string | null;
};

/**
 * Append-only admin audit log. Failures are logged and swallowed so callers
 * never break the primary action (project plan §79.3 / M19.0a).
 */
export async function writeAuditLog(
  db: Db,
  input: WriteAuditLogInput,
): Promise<void> {
  try {
    await insertAuditLog(db, {
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.before ?? null,
      afterJson: input.after ?? null,
      reason: input.reason ?? null,
      requestId: input.requestId ?? null,
    });
  } catch (error) {
    logger.error("admin.audit_log.write", {
      status: "error",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export { listRecentAuditLogs };
