-- M22.0 — Admin-managed site branding (singleton settings + small binary assets).
-- Assets are intentionally small (logos/hero) and stored in Postgres so branding
-- works without a separate object-storage credential. Course media stays on the
-- existing remote-URL pipeline.

CREATE TABLE IF NOT EXISTS "site_settings" (
  "id" text PRIMARY KEY DEFAULT 'default',
  "hero_eyebrow" text,
  "hero_title" text,
  "hero_description" text,
  "search_placeholder" text,
  "hero_image_alt" text,
  "logo_asset_key" text,
  "logo_compact_asset_key" text,
  "favicon_asset_key" text,
  "hero_asset_key" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "site_settings" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "site_assets" (
  "key" text PRIMARY KEY,
  "content_type" text NOT NULL,
  "bytes" bytea NOT NULL,
  "byte_length" integer NOT NULL,
  "width" integer,
  "height" integer,
  "original_filename" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
