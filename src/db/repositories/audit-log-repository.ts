import { and, desc, eq } from "drizzle-orm";

import type { Db } from "@/db";
import {
  adminAuditLog,
  type AdminAuditLog,
  type NewAdminAuditLog,
} from "@/db/schema";

export type AuditLogInsert = Pick<
  NewAdminAuditLog,
  | "actorType"
  | "actorId"
  | "action"
  | "entityType"
  | "entityId"
  | "beforeJson"
  | "afterJson"
  | "reason"
  | "requestId"
>;

export async function insertAuditLog(
  db: Db,
  input: AuditLogInsert,
): Promise<AdminAuditLog> {
  const rows = await db.insert(adminAuditLog).values(input).returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to insert admin audit log");
  }
  return row;
}

export async function listRecentAuditLogs(
  db: Db,
  options?: {
    limit?: number;
    entityType?: string;
    entityId?: string;
    action?: string;
  },
): Promise<AdminAuditLog[]> {
  const limit = options?.limit ?? 50;
  const conditions = [];

  if (options?.entityType) {
    conditions.push(eq(adminAuditLog.entityType, options.entityType));
  }
  if (options?.entityId) {
    conditions.push(eq(adminAuditLog.entityId, options.entityId));
  }
  if (options?.action) {
    conditions.push(eq(adminAuditLog.action, options.action));
  }

  const query = db.select().from(adminAuditLog);
  const filtered =
    conditions.length > 0 ? query.where(and(...conditions)) : query;

  return filtered.orderBy(desc(adminAuditLog.createdAt)).limit(limit);
}
