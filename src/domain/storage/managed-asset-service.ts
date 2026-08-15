import { and, eq, isNull, lt, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  managedAssets,
  type ManagedAsset,
  type ManagedAssetType,
} from "@/db/schema/managed-assets";
import { affiliateProducts } from "@/db/schema/affiliate-products";
import { courseMediaOverrides } from "@/db/schema/course-media-overrides";
import { courses } from "@/db/schema/courses";
import { siteSettings } from "@/db/schema/site-branding";
import {
  assertSafeStorageKey,
  buildStorageKey,
  sha256Hex,
} from "@/domain/storage/keys";
import {
  BRANDING_ALLOWED_MIME,
  MEDIA_ALLOWED_MIME,
  MEDIA_SIZE_LIMITS,
} from "@/domain/storage/limits";
import {
  getObjectStorageProvider,
  isObjectStorageEnabled,
} from "@/domain/storage/get-provider";
import type { ObjectStorageProvider } from "@/domain/storage/types";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

function sniffImageMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function validateManagedUpload(input: {
  assetType: ManagedAssetType;
  claimedMime: string;
  bytes: Buffer;
}): { ok: true; mime: string } | { ok: false; error: string } {
  const sniffed = sniffImageMime(input.bytes);
  const claimed = input.claimedMime.split(";")[0]!.trim().toLowerCase();

  if (!sniffed) {
    return { ok: false, error: "Tệp không phải ảnh JPEG/PNG/WebP hợp lệ." };
  }

  // Client MIME is not authority when magic bytes disagree.
  if (claimed && claimed !== sniffed && claimed !== "application/octet-stream") {
    if (
      !(claimed === "image/jpg" && sniffed === "image/jpeg") &&
      claimed !== sniffed
    ) {
      return {
        ok: false,
        error: `MIME không khớp nội dung (claim=${claimed}, actual=${sniffed}).`,
      };
    }
  }

  const allow =
    input.assetType === "BRANDING" ? BRANDING_ALLOWED_MIME : MEDIA_ALLOWED_MIME;
  if (!allow.has(sniffed)) {
    return { ok: false, error: "Định dạng ảnh không được hỗ trợ." };
  }

  const limit =
    input.assetType === "BRANDING"
      ? MEDIA_SIZE_LIMITS.brandingHero
      : input.assetType === "AFFILIATE_PRODUCT"
        ? MEDIA_SIZE_LIMITS.affiliateProduct
        : input.assetType === "COURSE_CACHE"
          ? MEDIA_SIZE_LIMITS.courseCache
          : MEDIA_SIZE_LIMITS.courseOverride;

  if (input.bytes.byteLength <= 0 || input.bytes.byteLength > limit) {
    return {
      ok: false,
      error: `Ảnh vượt giới hạn ${Math.round(limit / 1024)} KB.`,
    };
  }

  return { ok: true, mime: sniffed };
}

async function totalActiveBytes(db: Db): Promise<number> {
  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(${managedAssets.sizeBytes}), 0)::int`,
    })
    .from(managedAssets)
    .where(eq(managedAssets.status, "ACTIVE"));
  return rows[0]?.total ?? 0;
}

async function assertWithinBudget(db: Db, nextBytes: number): Promise<void> {
  const env = getServerEnv();
  if (env.MEDIA_MAX_TOTAL_BYTES <= 0) return;
  const used = await totalActiveBytes(db);
  if (used + nextBytes > env.MEDIA_MAX_TOTAL_BYTES) {
    throw new Error(
      "Đã vượt hạn mức lưu trữ media (MEDIA_MAX_TOTAL_BYTES). Upload bị từ chối.",
    );
  }
}

export async function resolveManagedAssetPublicUrl(
  db: Db,
  assetId: string | null | undefined,
  storage: ObjectStorageProvider = getObjectStorageProvider(),
): Promise<string | null> {
  if (!assetId) return null;
  const rows = await db
    .select()
    .from(managedAssets)
    .where(
      and(eq(managedAssets.id, assetId), eq(managedAssets.status, "ACTIVE")),
    )
    .limit(1);
  const asset = rows[0];
  if (!asset) return null;
  try {
    return storage.getPublicUrl(asset.storageKey);
  } catch {
    return null;
  }
}

export async function markAssetUnreferenced(
  db: Db,
  assetId: string | null | undefined,
): Promise<void> {
  if (!assetId) return;
  await db
    .update(managedAssets)
    .set({
      status: "UNREFERENCED",
      unreferencedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(managedAssets.id, assetId), eq(managedAssets.status, "ACTIVE")),
    );
}

export type UploadManagedAssetInput = {
  assetType: ManagedAssetType;
  bytes: Buffer;
  claimedMime: string;
  entityId?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  createdBy?: string | null;
  /** Skip hash reuse when ownership boundary requires a private copy. */
  allowDedup?: boolean;
};

export type UploadManagedAssetResult = {
  asset: ManagedAsset;
  publicUrl: string;
  reused: boolean;
};

/**
 * Validate → (dedup) → upload object → persist metadata.
 * Compensates by deleting the object if DB insert fails.
 */
export async function uploadManagedAsset(
  db: Db,
  input: UploadManagedAssetInput,
  storage: ObjectStorageProvider = getObjectStorageProvider(),
): Promise<UploadManagedAssetResult> {
  if (!isObjectStorageEnabled() && storage.name !== "fake") {
    throw new Error(
      "Object storage chưa bật (FEATURE_OBJECT_STORAGE / FEATURE_R2_UPLOADS).",
    );
  }

  const validated = validateManagedUpload({
    assetType: input.assetType,
    claimedMime: input.claimedMime,
    bytes: input.bytes,
  });
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  await assertWithinBudget(db, input.bytes.byteLength);

  const contentHash = sha256Hex(input.bytes);
  const allowDedup = input.allowDedup !== false;

  if (allowDedup) {
    const existing = await db
      .select()
      .from(managedAssets)
      .where(
        and(
          eq(managedAssets.contentHash, contentHash),
          eq(managedAssets.assetType, input.assetType),
          eq(managedAssets.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return {
        asset: existing[0],
        publicUrl: storage.getPublicUrl(existing[0].storageKey),
        reused: true,
      };
    }
  }

  const storageKey = buildStorageKey({
    assetType: input.assetType,
    mimeType: validated.mime,
    entityId: input.entityId,
    contentHash,
  });
  assertSafeStorageKey(storageKey);

  await storage.put({
    key: storageKey,
    bytes: input.bytes,
    contentType: validated.mime,
  });

  try {
    const rows = await db
      .insert(managedAssets)
      .values({
        assetType: input.assetType,
        storageProvider: storage.name,
        storageKey,
        mimeType: validated.mime,
        sizeBytes: input.bytes.byteLength,
        contentHash,
        status: "ACTIVE",
        sourceUrl: input.sourceUrl ?? null,
        sourceType: input.sourceType ?? null,
        createdBy: input.createdBy ?? null,
      })
      .returning();

    const asset = rows[0];
    if (!asset) throw new Error("Không lưu được metadata managed_assets.");

    return {
      asset,
      publicUrl: storage.getPublicUrl(storageKey),
      reused: false,
    };
  } catch (error) {
    try {
      await storage.delete(storageKey);
    } catch (deleteError) {
      logger.warn("storage.compensate_delete_failed", {
        storageKey,
        error:
          deleteError instanceof Error
            ? deleteError.message
            : "unknown_delete_error",
      });
      await db.insert(managedAssets).values({
        assetType: input.assetType,
        storageProvider: storage.name,
        storageKey,
        mimeType: validated.mime,
        sizeBytes: input.bytes.byteLength,
        contentHash,
        status: "UNREFERENCED",
        sourceUrl: input.sourceUrl ?? null,
        sourceType: "orphan_candidate",
        unreferencedAt: new Date(),
      });
    }
    throw error;
  }
}

export async function countAssetReferences(
  db: Db,
  assetId: string,
): Promise<number> {
  const [a, b, c, d] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(courseMediaOverrides)
      .where(eq(courseMediaOverrides.managedAssetId, assetId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(affiliateProducts)
      .where(eq(affiliateProducts.managedAssetId, assetId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(courses)
      .where(eq(courses.imageCacheAssetId, assetId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(siteSettings)
      .where(
        sql`${siteSettings.logoManagedAssetId} = ${assetId}
          or ${siteSettings.logoCompactManagedAssetId} = ${assetId}
          or ${siteSettings.faviconManagedAssetId} = ${assetId}
          or ${siteSettings.heroManagedAssetId} = ${assetId}`,
      ),
  ]);
  return (a[0]?.n ?? 0) + (b[0]?.n ?? 0) + (c[0]?.n ?? 0) + (d[0]?.n ?? 0);
}

export type OrphanCleanupSummary = {
  scanned: number;
  deleted: number;
  skippedReferenced: number;
  errors: number;
};

export async function runOrphanAssetCleanup(
  db: Db,
  options?: { now?: Date; storage?: ObjectStorageProvider },
): Promise<OrphanCleanupSummary> {
  const env = getServerEnv();
  const now = options?.now ?? new Date();
  const graceMs = env.MEDIA_ORPHAN_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - graceMs);
  const storage = options?.storage ?? getObjectStorageProvider();
  const limit = env.MEDIA_CLEANUP_BATCH_SIZE;

  const candidates = await db
    .select()
    .from(managedAssets)
    .where(
      and(
        eq(managedAssets.status, "UNREFERENCED"),
        lt(managedAssets.unreferencedAt, cutoff),
        isNull(managedAssets.deletedAt),
      ),
    )
    .limit(limit);

  const summary: OrphanCleanupSummary = {
    scanned: candidates.length,
    deleted: 0,
    skippedReferenced: 0,
    errors: 0,
  };

  for (const asset of candidates) {
    try {
      const refs = await countAssetReferences(db, asset.id);
      if (refs > 0) {
        summary.skippedReferenced += 1;
        await db
          .update(managedAssets)
          .set({
            status: "ACTIVE",
            unreferencedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(managedAssets.id, asset.id));
        continue;
      }

      await db
        .update(managedAssets)
        .set({ status: "PENDING_DELETE", updatedAt: new Date() })
        .where(eq(managedAssets.id, asset.id));

      await storage.delete(asset.storageKey);

      await db
        .update(managedAssets)
        .set({
          status: "DELETED",
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(managedAssets.id, asset.id));

      summary.deleted += 1;
    } catch (error) {
      summary.errors += 1;
      logger.warn("storage.orphan_cleanup", {
        assetId: asset.id,
        error: error instanceof Error ? error.message : "unknown",
      });
      await db
        .update(managedAssets)
        .set({ status: "ERROR", updatedAt: new Date() })
        .where(eq(managedAssets.id, asset.id));
    }
  }

  return summary;
}
