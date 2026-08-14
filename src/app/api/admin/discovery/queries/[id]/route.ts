import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  findDiscoveryQueryById,
  updateDiscoveryQuery,
} from "@/db/repositories/discovery-query-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { getSession } from "@/lib/auth/guards";
import { assertAdmin, authzResponse } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  enabled: z.boolean(),
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
    const existing = await findDiscoveryQueryById(db, id);
    if (!existing) {
      return NextResponse.json(
        { error: "Discovery query not found" },
        { status: 404 },
      );
    }

    const query = await updateDiscoveryQuery(db, id, {
      enabled: parsed.data.enabled,
    });

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "QUERY_TOGGLE",
      entityType: "discovery_query",
      entityId: id,
      before: { enabled: existing.enabled },
      after: { enabled: query.enabled },
    });

    return NextResponse.json({ query });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;

    logger.error("admin.discovery.queries.patch", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}
