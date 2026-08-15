import {
  deleteSiteAsset,
  ensureSiteSettings,
  getSiteSettings,
  listSiteAssets,
  updateSiteSettings,
  upsertSiteAsset,
  type SiteSettingsPatch,
} from "@/db/repositories/site-branding-repository";
import {
  SITE_ASSET_KEYS,
  type SiteAssetKey,
  type SiteSettings,
} from "@/db/schema/site-branding";
import { managedAssets } from "@/db/schema/managed-assets";
import { isObjectStorageEnabled, getObjectStorageProvider } from "@/domain/storage/get-provider";
import {
  markAssetUnreferenced,
  uploadManagedAsset,
} from "@/domain/storage/managed-asset-service";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { inArray } from "drizzle-orm";
import type { Db } from "@/db";

export const BRANDING_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

export const BRANDING_MAX_BYTES: Record<SiteAssetKey, number> = {
  logo: 512 * 1024,
  logo_compact: 256 * 1024,
  favicon: 128 * 1024,
  hero: 2 * 1024 * 1024,
};

export type ResolvedHeroCopy = {
  eyebrow: string;
  title: string;
  description: string;
  searchPlaceholder: string;
  heroImageAlt: string;
};

export type ResolvedBranding = {
  settings: SiteSettings | null;
  hero: ResolvedHeroCopy;
  logoUrl: string | null;
  logoCompactUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
};

function assetPublicUrl(key: string, updatedAt?: Date | null): string {
  const version = updatedAt ? updatedAt.getTime() : Date.now();
  return `/api/site-assets/${encodeURIComponent(key)}?v=${version}`;
}

/** Dictionary defaults when Admin has not overridden hero copy. */
export function defaultHeroCopy(): ResolvedHeroCopy {
  const dict = getDictionary("vi");
  return {
    eyebrow: dict.hero.eyebrow,
    title: dict.hero.headline,
    description: dict.hero.subhead,
    searchPlaceholder: dict.hero.searchPlaceholder,
    heroImageAlt: "FreeLearn Radar",
  };
}

export function resolveHeroCopy(
  settings: SiteSettings | null,
): ResolvedHeroCopy {
  const defaults = defaultHeroCopy();
  return {
    eyebrow: settings?.heroEyebrow?.trim() || defaults.eyebrow,
    title: settings?.heroTitle?.trim() || defaults.title,
    description: settings?.heroDescription?.trim() || defaults.description,
    searchPlaceholder:
      settings?.searchPlaceholder?.trim() || defaults.searchPlaceholder,
    heroImageAlt: settings?.heroImageAlt?.trim() || defaults.heroImageAlt,
  };
}

export async function resolveBranding(db: Db): Promise<ResolvedBranding> {
  const settings = await getSiteSettings(db);
  const hero = resolveHeroCopy(settings);

  const managedIds = [
    settings?.logoManagedAssetId,
    settings?.logoCompactManagedAssetId,
    settings?.faviconManagedAssetId,
    settings?.heroManagedAssetId,
  ].filter((id): id is string => Boolean(id));

  const managedUrlById = new Map<string, string>();
  if (managedIds.length > 0) {
    const rows = await db
      .select({
        id: managedAssets.id,
        storageKey: managedAssets.storageKey,
        storageProvider: managedAssets.storageProvider,
        status: managedAssets.status,
      })
      .from(managedAssets)
      .where(inArray(managedAssets.id, managedIds));

    const storage = getObjectStorageProvider();
    for (const row of rows) {
      if (row.status !== "ACTIVE") continue;
      try {
        managedUrlById.set(row.id, storage.getPublicUrl(row.storageKey));
      } catch {
        // Fall through to legacy.
      }
    }
  }

  const legacyKeys = [
    settings?.logoAssetKey,
    settings?.logoCompactAssetKey,
    settings?.faviconAssetKey,
    settings?.heroAssetKey,
  ].filter((key): key is string => Boolean(key));

  const legacyByKey = new Map<string, string>();
  if (legacyKeys.length > 0) {
    const assets = await listSiteAssets(db);
    for (const asset of assets) {
      if (legacyKeys.includes(asset.key)) {
        legacyByKey.set(asset.key, assetPublicUrl(asset.key, asset.updatedAt));
      }
    }
  }

  function pick(
    managedId: string | null | undefined,
    legacyKey: string | null | undefined,
  ): string | null {
    if (managedId && managedUrlById.has(managedId)) {
      return managedUrlById.get(managedId) ?? null;
    }
    if (legacyKey && legacyByKey.has(legacyKey)) {
      return legacyByKey.get(legacyKey) ?? null;
    }
    return null;
  }

  return {
    settings,
    hero,
    logoUrl: pick(settings?.logoManagedAssetId, settings?.logoAssetKey),
    logoCompactUrl: pick(
      settings?.logoCompactManagedAssetId,
      settings?.logoCompactAssetKey,
    ),
    faviconUrl: pick(settings?.faviconManagedAssetId, settings?.faviconAssetKey),
    heroImageUrl: pick(settings?.heroManagedAssetId, settings?.heroAssetKey),
  };
}

export function isSiteAssetKey(value: string): value is SiteAssetKey {
  return (SITE_ASSET_KEYS as readonly string[]).includes(value);
}

export function validateBrandingUpload(input: {
  key: SiteAssetKey;
  contentType: string;
  byteLength: number;
}): { ok: true } | { ok: false; error: string } {
  if (!BRANDING_ALLOWED_MIME.has(input.contentType)) {
    return {
      ok: false,
      error:
        "Định dạng không được hỗ trợ. Chỉ chấp nhận PNG, JPEG, WebP hoặc ICO.",
    };
  }

  // Favicon may be ICO; other slots should not use ICO.
  if (
    input.key !== "favicon" &&
    (input.contentType === "image/x-icon" ||
      input.contentType === "image/vnd.microsoft.icon")
  ) {
    return {
      ok: false,
      error: "File ICO chỉ dùng cho favicon.",
    };
  }

  const max = BRANDING_MAX_BYTES[input.key];
  if (input.byteLength <= 0 || input.byteLength > max) {
    return {
      ok: false,
      error: `Kích thước ảnh vượt giới hạn (${Math.round(max / 1024)} KB).`,
    };
  }

  return { ok: true };
}

export async function saveBrandingText(
  db: Db,
  patch: SiteSettingsPatch,
): Promise<SiteSettings> {
  await ensureSiteSettings(db);
  return updateSiteSettings(db, patch);
}

export async function saveBrandingAsset(
  db: Db,
  input: {
    key: SiteAssetKey;
    contentType: string;
    bytes: Buffer;
    originalFilename?: string | null;
    width?: number | null;
    height?: number | null;
    createdBy?: string | null;
  },
): Promise<{ settings: SiteSettings; url: string }> {
  const check = validateBrandingUpload({
    key: input.key,
    contentType: input.contentType,
    byteLength: input.bytes.byteLength,
  });
  if (!check.ok) {
    throw new Error(check.error);
  }

  const managedColumnByKey: Record<SiteAssetKey, keyof SiteSettingsPatch> = {
    logo: "logoManagedAssetId",
    logo_compact: "logoCompactManagedAssetId",
    favicon: "faviconManagedAssetId",
    hero: "heroManagedAssetId",
  };

  const legacyColumnByKey: Record<SiteAssetKey, keyof SiteSettingsPatch> = {
    logo: "logoAssetKey",
    logo_compact: "logoCompactAssetKey",
    favicon: "faviconAssetKey",
    hero: "heroAssetKey",
  };

  const current = await ensureSiteSettings(db);
  const previousManagedId = current[managedColumnByKey[input.key] as keyof SiteSettings] as
    | string
    | null
    | undefined;

  if (isObjectStorageEnabled()) {
    const uploaded = await uploadManagedAsset(db, {
      assetType: "BRANDING",
      bytes: input.bytes,
      claimedMime: input.contentType,
      entityId: input.key,
      sourceType: "ADMIN_BRANDING_UPLOAD",
      createdBy: input.createdBy ?? null,
      allowDedup: false,
    });

    const settings = await updateSiteSettings(db, {
      [managedColumnByKey[input.key]]: uploaded.asset.id,
      // Keep legacy key cleared so UI prefers managed URL.
      [legacyColumnByKey[input.key]]: null,
    });

    if (previousManagedId && previousManagedId !== uploaded.asset.id) {
      await markAssetUnreferenced(db, previousManagedId);
    }

    return { settings, url: uploaded.publicUrl };
  }

  const asset = await upsertSiteAsset(db, {
    key: input.key,
    contentType: input.contentType,
    bytes: input.bytes,
    byteLength: input.bytes.byteLength,
    width: input.width ?? null,
    height: input.height ?? null,
    originalFilename: input.originalFilename ?? null,
  });

  const settings = await updateSiteSettings(db, {
    [legacyColumnByKey[input.key]]: input.key,
  });

  return {
    settings,
    url: assetPublicUrl(input.key, asset.updatedAt),
  };
}

export async function clearBrandingAsset(
  db: Db,
  key: SiteAssetKey,
): Promise<SiteSettings> {
  await deleteSiteAsset(db, key);

  const managedColumnByKey: Record<SiteAssetKey, keyof SiteSettingsPatch> = {
    logo: "logoManagedAssetId",
    logo_compact: "logoCompactManagedAssetId",
    favicon: "faviconManagedAssetId",
    hero: "heroManagedAssetId",
  };

  const legacyColumnByKey: Record<SiteAssetKey, keyof SiteSettingsPatch> = {
    logo: "logoAssetKey",
    logo_compact: "logoCompactAssetKey",
    favicon: "faviconAssetKey",
    hero: "heroAssetKey",
  };

  const current = await ensureSiteSettings(db);
  const previousManagedId = current[
    managedColumnByKey[key] as keyof SiteSettings
  ] as string | null | undefined;

  const settings = await updateSiteSettings(db, {
    [legacyColumnByKey[key]]: null,
    [managedColumnByKey[key]]: null,
  });

  if (previousManagedId) {
    await markAssetUnreferenced(db, previousManagedId);
  }

  return settings;
}

/** Snapshot safe for audit logs — never includes binary bytes. */
export function brandingAuditSnapshot(settings: SiteSettings | null) {
  if (!settings) return null;
  return {
    heroEyebrow: settings.heroEyebrow,
    heroTitle: settings.heroTitle,
    heroDescription: settings.heroDescription,
    searchPlaceholder: settings.searchPlaceholder,
    heroImageAlt: settings.heroImageAlt,
    logoAssetKey: settings.logoAssetKey,
    logoCompactAssetKey: settings.logoCompactAssetKey,
    faviconAssetKey: settings.faviconAssetKey,
    heroAssetKey: settings.heroAssetKey,
    logoManagedAssetId: settings.logoManagedAssetId,
    logoCompactManagedAssetId: settings.logoCompactManagedAssetId,
    faviconManagedAssetId: settings.faviconManagedAssetId,
    heroManagedAssetId: settings.heroManagedAssetId,
  };
}
