import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  createAffiliateProductContext,
  findAffiliateProductById,
} from "@/db/repositories/affiliate-product-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { affiliateProductContextInputSchema } from "@/domain/affiliate/affiliate-product";
import { PLACEMENT_KEYS } from "@/domain/affiliate/resolve-placements";
import { getSession } from "@/lib/auth/guards";
import { assertEditor, authzResponse } from "@/lib/auth/rbac";

type RouteContext = { params: Promise<{ id: string }> };
const placementKeys = new Set<string>(Object.values(PLACEMENT_KEYS));

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    assertEditor(session);
    const { id } = await context.params;
    const db = getDb();
    if (!(await findAffiliateProductById(db, id))) {
      return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
    }
    const input = affiliateProductContextInputSchema.parse(await request.json());
    if (!placementKeys.has(input.placementKey)) {
      return NextResponse.json({ error: "Placement key không hợp lệ" }, { status: 400 });
    }
    const productContext = await createAffiliateProductContext(db, {
      ...input,
      productId: id,
    });
    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "AFFILIATE_PRODUCT_CONTEXT_CREATE",
      entityType: "affiliate_product_context",
      entityId: productContext.id,
      after: productContext,
    });
    return NextResponse.json({ context: productContext }, { status: 201 });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ngữ cảnh không hợp lệ" }, { status: 400 });
    }
    return NextResponse.json({ error: "Không thể thêm ngữ cảnh" }, { status: 500 });
  }
}
