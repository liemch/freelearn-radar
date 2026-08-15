import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { findAffiliateProductById, updateAffiliateProduct } from "@/db/repositories/affiliate-product-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { isObjectStorageEnabled } from "@/domain/storage/get-provider";
import {
  markAssetUnreferenced,
  uploadManagedAsset,
} from "@/domain/storage/managed-asset-service";
import { getSession } from "@/lib/auth/guards";
import { assertEditor, authzResponse } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    assertEditor(session);
    const { id } = await context.params;
    const db = getDb();
    const row = await findAffiliateProductById(db, id);
    if (!row) {
      return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Cần multipart upload" }, { status: 400 });
    }

    if (!isObjectStorageEnabled()) {
      return NextResponse.json(
        {
          error:
            "Object storage chưa bật. Bật FEATURE_OBJECT_STORAGE + FEATURE_R2_UPLOADS hoặc dán URL ảnh.",
        },
        { status: 400 },
      );
    }

    const form = await request.formData();
    const action = String(form.get("action") ?? "upload");

    if (action === "clear") {
      const previous = row.product.managedAssetId;
      await updateAffiliateProduct(db, id, {
        managedAssetId: null,
        imageUrl: null,
      });
      if (previous) await markAssetUnreferenced(db, previous);
      await writeAuditLog(db, {
        actorType: "USER",
        actorId: session.userId,
        action: "AFFILIATE_PRODUCT_IMAGE_CLEAR",
        entityType: "affiliate_product",
        entityId: id,
      });
      return NextResponse.json({ ok: true });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu tệp ảnh." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadManagedAsset(db, {
      assetType: "AFFILIATE_PRODUCT",
      bytes,
      claimedMime: file.type || "application/octet-stream",
      entityId: id,
      sourceType: "ADMIN_UPLOAD",
      createdBy: session.userId,
    });

    const previous = row.product.managedAssetId;
    await updateAffiliateProduct(db, id, {
      managedAssetId: uploaded.asset.id,
      imageUrl: uploaded.publicUrl,
    });
    if (previous && previous !== uploaded.asset.id) {
      await markAssetUnreferenced(db, previous);
    }

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "AFFILIATE_PRODUCT_IMAGE_UPLOAD",
      entityType: "affiliate_product",
      entityId: id,
      after: { managedAssetId: uploaded.asset.id, imageUrl: uploaded.publicUrl },
    });

    return NextResponse.json({ ok: true, imageUrl: uploaded.publicUrl });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    logger.error("admin.affiliate.product.image", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Không tải được ảnh sản phẩm",
      },
      { status: 400 },
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
