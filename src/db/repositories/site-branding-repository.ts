import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import {
  SITE_SETTINGS_ID,
  siteAssets,
  siteSettings,
  type NewSiteAsset,
  type SiteAsset,
  type SiteAssetKey,
  type SiteSettings,
} from "@/db/schema/site-branding";

export type SiteSettingsPatch = Partial<{
  heroEyebrow: string | null;
  heroTitle: string | null;
  heroDescription: string | null;
  searchPlaceholder: string | null;
  heroImageAlt: string | null;
  logoAssetKey: string | null;
  logoCompactAssetKey: string | null;
  faviconAssetKey: string | null;
  heroAssetKey: string | null;
  logoManagedAssetId: string | null;
  logoCompactManagedAssetId: string | null;
  faviconManagedAssetId: string | null;
  heroManagedAssetId: string | null;
}>;

export async function getSiteSettings(db: Db): Promise<SiteSettings | null> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, SITE_SETTINGS_ID))
    .limit(1);
  return rows[0] ?? null;
}

export async function ensureSiteSettings(db: Db): Promise<SiteSettings> {
  const existing = await getSiteSettings(db);
  if (existing) return existing;

  const inserted = await db
    .insert(siteSettings)
    .values({ id: SITE_SETTINGS_ID })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) return inserted[0];

  const again = await getSiteSettings(db);
  if (!again) {
    throw new Error("Failed to ensure site_settings singleton");
  }
  return again;
}

export async function updateSiteSettings(
  db: Db,
  patch: SiteSettingsPatch,
): Promise<SiteSettings> {
  await ensureSiteSettings(db);
  const rows = await db
    .update(siteSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(siteSettings.id, SITE_SETTINGS_ID))
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("site_settings update returned no row");
  }
  return row;
}

export async function listSiteAssets(db: Db): Promise<SiteAsset[]> {
  return db.select().from(siteAssets);
}

export async function getSiteAsset(
  db: Db,
  key: SiteAssetKey | string,
): Promise<SiteAsset | null> {
  const rows = await db
    .select()
    .from(siteAssets)
    .where(eq(siteAssets.key, key))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertSiteAsset(
  db: Db,
  asset: NewSiteAsset,
): Promise<SiteAsset> {
  const rows = await db
    .insert(siteAssets)
    .values({ ...asset, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteAssets.key,
      set: {
        contentType: asset.contentType,
        bytes: asset.bytes,
        byteLength: asset.byteLength,
        width: asset.width ?? null,
        height: asset.height ?? null,
        originalFilename: asset.originalFilename ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("site_assets upsert returned no row");
  }
  return row;
}

export async function deleteSiteAsset(
  db: Db,
  key: SiteAssetKey | string,
): Promise<void> {
  await db.delete(siteAssets).where(eq(siteAssets.key, key));
}
