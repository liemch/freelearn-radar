import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  countUsersByRole,
  findUserById,
  updateUserRole,
} from "@/db/repositories/user-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { getSession } from "@/lib/auth/guards";
import { assertAdmin, authzResponse } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  role: z.enum(["ADMIN", "EDITOR"]),
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

    const user = await updateUserRole(db, id, parsed.data.role);

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "USER_ROLE_UPDATE",
      entityType: "user",
      entityId: id,
      before: { role: existing.role },
      after: { role: user.role },
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
