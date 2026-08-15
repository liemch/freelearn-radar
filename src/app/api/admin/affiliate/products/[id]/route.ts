import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  deleteAffiliateProduct,
  findAffiliateProductById,
  listAffiliateProductContexts,
  updateAffiliateProduct,
} from "@/db/repositories/affiliate-product-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { affiliateProductInputSchema } from "@/domain/affiliate/affiliate-product";
import { getSession } from "@/lib/auth/guards";
import { assertEditor, authzResponse } from "@/lib/auth/rbac";

type RouteContext = { params: Promise<{ id: string }> };
const patchBodySchema = z.record(z.string(), z.unknown());

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    assertEditor(session);
    const { id } = await context.params;
    const db = getDb();
    const row = await findAffiliateProductById(db, id);
    if (!row) {
      return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
    }
    const contexts = await listAffiliateProductContexts(db, id);
    return NextResponse.json({ ...row, contexts });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    return NextResponse.json({ error: "Không thể tải sản phẩm" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    assertEditor(session);
    const { id } = await context.params;
    const db = getDb();
    const existing = await findAffiliateProductById(db, id);
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
    }
    const body = patchBodySchema.parse(await request.json());
    const input = affiliateProductInputSchema.parse({
      ...existing.product,
      ...body,
    });
    const product = await updateAffiliateProduct(db, id, input);
    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "AFFILIATE_PRODUCT_UPDATE",
      entityType: "affiliate_product",
      entityId: id,
      before: existing.product,
      after: product,
    });
    return NextResponse.json({ product });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dữ liệu sản phẩm không hợp lệ", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Không thể cập nhật" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    assertEditor(session);
    const { id } = await context.params;
    const db = getDb();
    const existing = await findAffiliateProductById(db, id);
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
    }
    await deleteAffiliateProduct(db, id);
    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "AFFILIATE_PRODUCT_DELETE",
      entityType: "affiliate_product",
      entityId: id,
      before: existing.product,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    return NextResponse.json({ error: "Không thể xóa sản phẩm" }, { status: 500 });
  }
}
