import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { deleteAffiliateProductContext } from "@/db/repositories/affiliate-product-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { getSession } from "@/lib/auth/guards";
import { assertEditor, authzResponse } from "@/lib/auth/rbac";

type RouteContext = {
  params: Promise<{ id: string; contextId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    assertEditor(session);
    const { id, contextId } = await context.params;
    const db = getDb();
    const deleted = await deleteAffiliateProductContext(db, id, contextId);
    if (!deleted) {
      return NextResponse.json({ error: "Không tìm thấy ngữ cảnh" }, { status: 404 });
    }
    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "AFFILIATE_PRODUCT_CONTEXT_DELETE",
      entityType: "affiliate_product_context",
      entityId: contextId,
      before: { productId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    return NextResponse.json({ error: "Không thể xóa ngữ cảnh" }, { status: 500 });
  }
}
