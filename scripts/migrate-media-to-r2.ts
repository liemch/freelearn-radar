/**
 * Legacy bytea → object storage migration utility (M24).
 *
 * Default: DRY RUN only. Never deletes legacy bytea.
 *
 * Usage:
 *   npx tsx scripts/migrate-media-to-r2.ts
 *   npx tsx scripts/migrate-media-to-r2.ts --execute
 *
 * Requires FEATURE_OBJECT_STORAGE=true FEATURE_R2_UPLOADS=true and R2 creds
 * for --execute.
 */

import { isNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { courseMediaOverrides } from "@/db/schema/course-media-overrides";
import { siteAssets } from "@/db/schema/site-branding";
import { courses } from "@/db/schema/courses";
import { eq } from "drizzle-orm";
import {
  isObjectStorageEnabled,
  getObjectStorageProvider,
} from "@/domain/storage/get-provider";
import { uploadManagedAsset } from "@/domain/storage/managed-asset-service";

type ReportRow = {
  kind: "site_asset" | "course_override";
  id: string;
  bytes: number;
  targetKeyHint: string;
};

async function main() {
  const execute = process.argv.includes("--execute");
  const db = getDb();

  const branding = await db
    .select({
      key: siteAssets.key,
      byteLength: siteAssets.byteLength,
      contentType: siteAssets.contentType,
      bytes: siteAssets.bytes,
    })
    .from(siteAssets);

  const overrides = await db
    .select({
      courseId: courseMediaOverrides.courseId,
      byteLength: courseMediaOverrides.byteLength,
      contentType: courseMediaOverrides.contentType,
      bytes: courseMediaOverrides.bytes,
      managedAssetId: courseMediaOverrides.managedAssetId,
    })
    .from(courseMediaOverrides)
    .where(isNull(courseMediaOverrides.managedAssetId));

  const report: ReportRow[] = [];
  let totalBytes = 0;

  for (const row of branding) {
    const bytes = row.byteLength ?? 0;
    totalBytes += bytes;
    report.push({
      kind: "site_asset",
      id: row.key,
      bytes,
      targetKeyHint: `branding/${row.key}/{uuid}`,
    });
  }

  for (const row of overrides) {
    if (!row.bytes || !row.byteLength) continue;
    totalBytes += row.byteLength;
    report.push({
      kind: "course_override",
      id: row.courseId,
      bytes: row.byteLength,
      targetKeyHint: `courses/${row.courseId}/override/{uuid}`,
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: execute ? "EXECUTE" : "DRY_RUN",
        objectStorageEnabled: isObjectStorageEnabled(),
        assetCount: report.length,
        totalBytes,
        assets: report,
      },
      null,
      2,
    ),
  );

  if (!execute) {
    console.log(
      "\nDRY RUN only. Re-run with --execute after enabling R2 flags/credentials.",
    );
    return;
  }

  if (!isObjectStorageEnabled()) {
    throw new Error("Object storage flags/credentials are required for --execute");
  }

  const storage = getObjectStorageProvider();
  let migrated = 0;

  for (const row of branding) {
    if (!row.bytes) continue;
    const uploaded = await uploadManagedAsset(
      db,
      {
        assetType: "BRANDING",
        bytes: Buffer.isBuffer(row.bytes)
          ? row.bytes
          : Buffer.from(row.bytes as unknown as ArrayBuffer),
        claimedMime: row.contentType,
        entityId: row.key,
        sourceType: "LEGACY_SITE_ASSET_MIGRATION",
        allowDedup: false,
      },
      storage,
    );
    // Do not delete site_assets.bytes in this run.
    console.log(`migrated branding ${row.key} → ${uploaded.asset.id}`);
    migrated += 1;
  }

  for (const row of overrides) {
    if (!row.bytes || !row.byteLength) continue;
    const uploaded = await uploadManagedAsset(
      db,
      {
        assetType: "COURSE_OVERRIDE",
        bytes: Buffer.isBuffer(row.bytes)
          ? row.bytes
          : Buffer.from(row.bytes as unknown as ArrayBuffer),
        claimedMime: row.contentType ?? "image/jpeg",
        entityId: row.courseId,
        sourceType: "LEGACY_COURSE_OVERRIDE_MIGRATION",
      },
      storage,
    );

    await db
      .update(courseMediaOverrides)
      .set({
        managedAssetId: uploaded.asset.id,
        // Keep legacy bytes until a later cleanup milestone.
        updatedAt: new Date(),
      })
      .where(eq(courseMediaOverrides.courseId, row.courseId));

    await db
      .update(courses)
      .set({
        imageOverrideUrl: uploaded.publicUrl,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, row.courseId));

    console.log(`migrated course override ${row.courseId} → ${uploaded.asset.id}`);
    migrated += 1;
  }

  console.log(
    JSON.stringify({
      migrated,
      note: "Legacy bytea rows were NOT deleted.",
      storageProvider: storage.name,
    }),
  );

  // Touch sql import so tree-shaking doesn't strip helpers in some tooling.
  void sql;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
