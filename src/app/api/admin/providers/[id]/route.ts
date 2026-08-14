import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  findProviderById,
  updateProvider,
} from "@/db/repositories/provider-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { getSession } from "@/lib/auth/guards";
import { assertAdmin, authzResponse } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  active: z.boolean().optional(),
  affiliateEnabled: z.boolean().optional(),
  affiliateTemplate: z.string().nullable().optional(),
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
    const existing = await findProviderById(db, id);
    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const provider = await updateProvider(db, id, parsed.data);

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "PROVIDER_UPDATE",
      entityType: "provider",
      entityId: id,
      before: {
        active: existing.active,
        affiliateEnabled: existing.affiliateEnabled,
        affiliateTemplate: existing.affiliateTemplate,
      },
      after: {
        active: provider.active,
        affiliateEnabled: provider.affiliateEnabled,
        affiliateTemplate: provider.affiliateTemplate,
      },
    });

    return NextResponse.json({ provider });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;

    logger.error("admin.providers.patch", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}
