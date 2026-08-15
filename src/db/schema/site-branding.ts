import {
  integer,
  pgTable,
  text,
  timestamp,
  customType,
} from "drizzle-orm/pg-core";

/** Raw binary for small branding assets (logos / hero). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Singleton site branding configuration.
 * Content only — layout/design stays in frontend code.
 */
export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey().default("default"),
  heroEyebrow: text("hero_eyebrow"),
  heroTitle: text("hero_title"),
  heroDescription: text("hero_description"),
  searchPlaceholder: text("search_placeholder"),
  heroImageAlt: text("hero_image_alt"),
  logoAssetKey: text("logo_asset_key"),
  logoCompactAssetKey: text("logo_compact_asset_key"),
  faviconAssetKey: text("favicon_asset_key"),
  heroAssetKey: text("hero_asset_key"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const siteAssets = pgTable("site_assets", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  bytes: bytea("bytes").notNull(),
  byteLength: integer("byte_length").notNull(),
  width: integer("width"),
  height: integer("height"),
  originalFilename: text("original_filename"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SiteSettings = typeof siteSettings.$inferSelect;
export type NewSiteSettings = typeof siteSettings.$inferInsert;
export type SiteAsset = typeof siteAssets.$inferSelect;
export type NewSiteAsset = typeof siteAssets.$inferInsert;

export const SITE_SETTINGS_ID = "default" as const;

export const SITE_ASSET_KEYS = [
  "logo",
  "logo_compact",
  "favicon",
  "hero",
] as const;

export type SiteAssetKey = (typeof SITE_ASSET_KEYS)[number];
