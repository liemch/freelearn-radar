-- M24 — Managed assets metadata for object storage (Postgres = metadata only).
-- Legacy site_assets / course_media_overrides bytea columns are retained.

DO $$ BEGIN
  CREATE TYPE "managed_asset_type" AS ENUM (
    'BRANDING',
    'COURSE_OVERRIDE',
    'COURSE_CACHE',
    'AFFILIATE_PRODUCT',
    'FALLBACK',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "managed_asset_status" AS ENUM (
    'ACTIVE',
    'UNREFERENCED',
    'PENDING_DELETE',
    'DELETED',
    'ERROR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "managed_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_type" "managed_asset_type" NOT NULL,
  "storage_provider" text NOT NULL DEFAULT 'r2',
  "storage_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "width" integer,
  "height" integer,
  "content_hash" text NOT NULL,
  "status" "managed_asset_status" NOT NULL DEFAULT 'ACTIVE',
  "source_url" text,
  "source_type" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "unreferenced_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "managed_assets_storage_key_unique"
  ON "managed_assets" ("storage_key");

CREATE INDEX IF NOT EXISTS "managed_assets_hash_type_idx"
  ON "managed_assets" ("content_hash", "asset_type");

CREATE INDEX IF NOT EXISTS "managed_assets_status_unref_idx"
  ON "managed_assets" ("status", "unreferenced_at");

CREATE INDEX IF NOT EXISTS "managed_assets_type_status_idx"
  ON "managed_assets" ("asset_type", "status");

ALTER TABLE "course_media_overrides"
  ADD COLUMN IF NOT EXISTS "managed_asset_id" uuid
    REFERENCES "managed_assets"("id") ON DELETE SET NULL;

ALTER TABLE "affiliate_products"
  ADD COLUMN IF NOT EXISTS "managed_asset_id" uuid
    REFERENCES "managed_assets"("id") ON DELETE SET NULL;

ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "logo_managed_asset_id" uuid
    REFERENCES "managed_assets"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "logo_compact_managed_asset_id" uuid
    REFERENCES "managed_assets"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "favicon_managed_asset_id" uuid
    REFERENCES "managed_assets"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "hero_managed_asset_id" uuid
    REFERENCES "managed_assets"("id") ON DELETE SET NULL;

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "image_cache_asset_id" uuid
    REFERENCES "managed_assets"("id") ON DELETE SET NULL;
