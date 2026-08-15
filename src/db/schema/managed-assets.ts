import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const managedAssetTypeEnum = pgEnum("managed_asset_type", [
  "BRANDING",
  "COURSE_OVERRIDE",
  "COURSE_CACHE",
  "AFFILIATE_PRODUCT",
  "FALLBACK",
  "OTHER",
]);

export const managedAssetStatusEnum = pgEnum("managed_asset_status", [
  "ACTIVE",
  "UNREFERENCED",
  "PENDING_DELETE",
  "DELETED",
  "ERROR",
]);

export const managedAssets = pgTable(
  "managed_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetType: managedAssetTypeEnum("asset_type").notNull(),
    storageProvider: text("storage_provider").notNull().default("r2"),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    contentHash: text("content_hash").notNull(),
    status: managedAssetStatusEnum("status").notNull().default("ACTIVE"),
    sourceUrl: text("source_url"),
    sourceType: text("source_type"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    unreferencedAt: timestamp("unreferenced_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("managed_assets_storage_key_unique").on(table.storageKey),
    index("managed_assets_hash_type_idx").on(table.contentHash, table.assetType),
    index("managed_assets_status_unref_idx").on(
      table.status,
      table.unreferencedAt,
    ),
    index("managed_assets_type_status_idx").on(table.assetType, table.status),
  ],
);

export type ManagedAsset = typeof managedAssets.$inferSelect;
export type NewManagedAsset = typeof managedAssets.$inferInsert;
export type ManagedAssetType = ManagedAsset["assetType"];
export type ManagedAssetStatus = ManagedAsset["status"];
