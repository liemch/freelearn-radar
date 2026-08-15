import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { writeAuditLog } from "@/domain/admin/audit-log";
import {
  brandingAuditSnapshot,
  clearBrandingAsset,
  isSiteAssetKey,
  resolveBranding,
  saveBrandingAsset,
  saveBrandingText,
} from "@/domain/branding/site-branding";
import { revalidatePublicBranding } from "@/domain/branding/revalidate-public";
import { getSession } from "@/lib/auth/guards";
import { assertAdmin, authzResponse } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

const textPatchSchema = z.object({
  heroEyebrow: z.string().max(120).nullable().optional(),
  heroTitle: z.string().max(160).nullable().optional(),
  heroDescription: z.string().max(480).nullable().optional(),
  searchPlaceholder: z.string().max(160).nullable().optional(),
  heroImageAlt: z.string().max(160).nullable().optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    assertAdmin(session);

    const db = getDb();
    const branding = await resolveBranding(db);
    return NextResponse.json({
      settings: brandingAuditSnapshot(branding.settings),
      hero: branding.hero,
      logoUrl: branding.logoUrl,
      logoCompactUrl: branding.logoCompactUrl,
      faviconUrl: branding.faviconUrl,
      heroImageUrl: branding.heroImageUrl,
    });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    return NextResponse.json({ error: "Không đọc được cấu hình" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    assertAdmin(session);

    const contentType = request.headers.get("content-type") ?? "";
    const db = getDb();
    const before = brandingAuditSnapshot(
      (await resolveBranding(db)).settings,
    );

    // Multipart = asset upload or clear.
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const keyRaw = String(form.get("key") ?? "");
      const action = String(form.get("action") ?? "upload");

      if (!isSiteAssetKey(keyRaw)) {
        return NextResponse.json(
          { error: "Khóa tài sản không hợp lệ." },
          { status: 400 },
        );
      }

      if (action === "clear") {
        const settings = await clearBrandingAsset(db, keyRaw);
        await writeAuditLog(db, {
          actorType: "USER",
          actorId: session.userId,
          action: "SITE_BRANDING_ASSET_CLEAR",
          entityType: "site_settings",
          entityId: "default",
          before,
          after: brandingAuditSnapshot(settings),
        });
        const branding = await resolveBranding(db);
        revalidatePublicBranding();
        return NextResponse.json({
          ok: true,
          settings: brandingAuditSnapshot(branding.settings),
          logoUrl: branding.logoUrl,
          logoCompactUrl: branding.logoCompactUrl,
          faviconUrl: branding.faviconUrl,
          heroImageUrl: branding.heroImageUrl,
        });
      }

      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Thiếu tệp ảnh." },
          { status: 400 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const bytes = Buffer.from(arrayBuffer);
      const mime = file.type || "application/octet-stream";

      const result = await saveBrandingAsset(db, {
        key: keyRaw,
        contentType: mime,
        bytes,
        originalFilename: file.name,
      });

      await writeAuditLog(db, {
        actorType: "USER",
        actorId: session.userId,
        action: "SITE_BRANDING_ASSET_UPLOAD",
        entityType: "site_settings",
        entityId: "default",
        before,
        after: {
          ...brandingAuditSnapshot(result.settings),
          uploadedKey: keyRaw,
          contentType: mime,
          byteLength: bytes.byteLength,
        },
      });

      const branding = await resolveBranding(db);
      revalidatePublicBranding();
      return NextResponse.json({
        ok: true,
        settings: brandingAuditSnapshot(branding.settings),
        logoUrl: branding.logoUrl,
        logoCompactUrl: branding.logoCompactUrl,
        faviconUrl: branding.faviconUrl,
        heroImageUrl: branding.heroImageUrl,
        uploadedUrl: result.url,
      });
    }

    // JSON = text fields.
    const parsed = textPatchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Empty strings become null → fall back to dictionary defaults.
    const normalize = (value: string | null | undefined) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    };

    const settings = await saveBrandingText(db, {
      heroEyebrow: normalize(parsed.data.heroEyebrow),
      heroTitle: normalize(parsed.data.heroTitle),
      heroDescription: normalize(parsed.data.heroDescription),
      searchPlaceholder: normalize(parsed.data.searchPlaceholder),
      heroImageAlt: normalize(parsed.data.heroImageAlt),
    });

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "SITE_BRANDING_UPDATE",
      entityType: "site_settings",
      entityId: "default",
      before,
      after: brandingAuditSnapshot(settings),
    });

    const branding = await resolveBranding(db);
    revalidatePublicBranding();
    return NextResponse.json({
      ok: true,
      settings: brandingAuditSnapshot(branding.settings),
      hero: branding.hero,
    });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;

    logger.error("admin.branding.patch", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không lưu được cấu hình giao diện",
      },
      { status: 400 },
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
