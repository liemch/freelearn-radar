import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  createAffiliateProduct,
  listAffiliateProducts,
} from "@/db/repositories/affiliate-product-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { affiliateProductInputSchema } from "@/domain/affiliate/affiliate-product";
import { getSession } from "@/lib/auth/guards";
import { assertEditor, authzResponse } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    assertEditor(session);
    const merchant = request.nextUrl.searchParams.get("merchant");
    const products = await listAffiliateProducts(getDb(), {
      query: request.nextUrl.searchParams.get("q") ?? undefined,
      merchant:
        merchant === "SHOPEE" || merchant === "LAZADA"
          ? merchant
          : undefined,
    });
    return NextResponse.json({ products });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    return NextResponse.json({ error: "Không thể tải sản phẩm" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    assertEditor(session);
    const input = affiliateProductInputSchema.parse(await request.json());
    const db = getDb();
    const product = await createAffiliateProduct(db, input);
    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "AFFILIATE_PRODUCT_CREATE",
      entityType: "affiliate_product",
      entityId: product.id,
      after: product,
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dữ liệu sản phẩm không hợp lệ", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Không thể tạo sản phẩm" }, { status: 500 });
  }
}
