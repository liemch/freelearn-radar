import type { Db } from "@/db";
import {
  deleteSiteAsset,
  ensureSiteSettings,
  getSiteAsset,
  getSiteSettings,
  updateSiteSettings,
  upsertSiteAsset,
  type SiteSettingsPatch,
} from "@/db/repositories/site-branding-repository";
import {
  SITE_ASSET_KEYS,
  type SiteAssetKey,
  type SiteSettings,
} from "@/db/schema/site-branding";
import { getDictionary } from "@/lib/i18n/get-dictionary";

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
  hero: 1024 * 1024,
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

  async function urlFor(key: string | null | undefined): Promise<string | null> {
    if (!key) return null;
    const asset = await getSiteAsset(db, key);
    if (!asset) return null;
    return assetPublicUrl(key, asset.updatedAt);
  }

  return {
    settings,
    hero,
    logoUrl: await urlFor(settings?.logoAssetKey),
    logoCompactUrl: await urlFor(settings?.logoCompactAssetKey),
    faviconUrl: await urlFor(settings?.faviconAssetKey),
    heroImageUrl: await urlFor(settings?.heroAssetKey),
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

  const asset = await upsertSiteAsset(db, {
    key: input.key,
    contentType: input.contentType,
    bytes: input.bytes,
    byteLength: input.bytes.byteLength,
    width: input.width ?? null,
    height: input.height ?? null,
    originalFilename: input.originalFilename ?? null,
  });

  const columnByKey: Record<SiteAssetKey, keyof SiteSettingsPatch> = {
    logo: "logoAssetKey",
    logo_compact: "logoCompactAssetKey",
    favicon: "faviconAssetKey",
    hero: "heroAssetKey",
  };

  const settings = await updateSiteSettings(db, {
    [columnByKey[input.key]]: input.key,
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

  const columnByKey: Record<SiteAssetKey, keyof SiteSettingsPatch> = {
    logo: "logoAssetKey",
    logo_compact: "logoCompactAssetKey",
    favicon: "faviconAssetKey",
    hero: "heroAssetKey",
  };

  return updateSiteSettings(db, {
    [columnByKey[key]]: null,
  });
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
  };
}
