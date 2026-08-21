import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  countUsersByRole,
  findUserById,
  revokeUserSessions,
  updateUserRole,
} from "@/db/repositories/user-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { getSession } from "@/lib/auth/guards";
import { assertAdmin, authzResponse } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    role: z.enum(["ADMIN", "EDITOR"]).optional(),
    /** Force every existing session of this user to fail its next request. */
    revokeSessions: z.boolean().optional(),
  })
  .refine((body) => body.role !== undefined || body.revokeSessions === true, {
    message: "Provide a role or revokeSessions",
  });

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    assertAdmin(session);

    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const db = getDb();
    const existing = await findUserById(db, id);
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      parsed.data.role !== undefined &&
      existing.role === "ADMIN" &&
      parsed.data.role !== "ADMIN"
    ) {
      const adminCount = await countUsersByRole(db, "ADMIN");
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last ADMIN" },
          { status: 400 },
        );
      }
    }

    const user =
      parsed.data.role !== undefined
        ? await updateUserRole(db, id, parsed.data.role)
        : await revokeUserSessions(db, id);

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action:
        parsed.data.role !== undefined
          ? "USER_ROLE_UPDATE"
          : "USER_SESSIONS_REVOKED",
      entityType: "user",
      entityId: id,
      before: {
        role: existing.role,
        sessionVersion: existing.sessionVersion,
      },
      after: { role: user.role, sessionVersion: user.sessionVersion },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;

    logger.error("admin.users.patch", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}
