-- M20.12 Monetization Foundation
-- Additive. Does not alter Truth, search ranking, or free eligibility.

DO $$ BEGIN
  CREATE TYPE "public"."affiliate_provider_type" AS ENUM('COURSE', 'COMMERCE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."commerce_product_group" AS ENUM(
    'BOOK',
    'LAPTOP_TABLET',
    'MONITOR',
    'KEYBOARD_MOUSE',
    'HEADSET_WEBCAM_MIC',
    'LAPTOP_STAND',
    'DESK_LIGHT',
    'STUDY_ACCESSORY',
    'LAB_NETWORKING_DEVICE',
    'OTHER_LEARNING_RELATED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "affiliate_providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_key" text NOT NULL,
  "provider_type" "public"."affiliate_provider_type" NOT NULL,
  "display_name" text NOT NULL,
  "allowed_hosts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "enabled" boolean NOT NULL DEFAULT false,
  "disclosure_required" boolean NOT NULL DEFAULT true,
  "disclosure_text_vi" text,
  "disclosure_text_en" text,
  "tracking_capability" text DEFAULT 'INTERNAL',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_providers_provider_key_uidx"
  ON "affiliate_providers" ("provider_key");

CREATE TABLE IF NOT EXISTS "affiliate_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "affiliate_provider_id" uuid NOT NULL REFERENCES "affiliate_providers"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "campaign_key" text NOT NULL,
  "destination_template" text NOT NULL,
  "product_group" "public"."commerce_product_group",
  "enabled" boolean NOT NULL DEFAULT false,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "metadata_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_campaigns_campaign_key_uidx"
  ON "affiliate_campaigns" ("campaign_key");

CREATE INDEX IF NOT EXISTS "affiliate_campaigns_provider_id_idx"
  ON "affiliate_campaigns" ("affiliate_provider_id");

CREATE TABLE IF NOT EXISTS "affiliate_placements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "affiliate_campaigns"("id") ON DELETE CASCADE,
  "placement_key" text NOT NULL,
  "topic_slug" text,
  "category_slug" text,
  "course_id" uuid REFERENCES "courses"("id") ON DELETE SET NULL,
  "locale" text,
  "priority" integer NOT NULL DEFAULT 100,
  "enabled" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "affiliate_placements_key_idx"
  ON "affiliate_placements" ("placement_key", "enabled");

CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_key" text NOT NULL,
  "campaign_id" uuid REFERENCES "affiliate_campaigns"("id") ON DELETE SET NULL,
  "placement_key" text NOT NULL,
  "course_id" uuid REFERENCES "courses"("id") ON DELETE SET NULL,
  "topic_slug" text,
  "locale" text,
  "destination_host" text,
  "clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "affiliate_clicks_clicked_at_idx"
  ON "affiliate_clicks" ("clicked_at");

CREATE INDEX IF NOT EXISTS "affiliate_clicks_provider_key_idx"
  ON "affiliate_clicks" ("provider_key", "clicked_at");
