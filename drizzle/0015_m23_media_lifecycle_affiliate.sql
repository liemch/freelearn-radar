-- M23 — Course media overrides, lifecycle helpers, affiliate products.

-- 1. Admin course image override (presentation only; source evidence untouched).
ALTER TYPE "course_image_source_type" ADD VALUE IF NOT EXISTS 'ADMIN_OVERRIDE';

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "image_override_url" text,
  ADD COLUMN IF NOT EXISTS "duplicate_of_course_id" uuid
    REFERENCES "courses"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "course_media_overrides" (
  "course_id" uuid PRIMARY KEY REFERENCES "courses"("id") ON DELETE CASCADE,
  "content_type" text,
  "bytes" bytea,
  "byte_length" integer,
  "remote_url" text,
  "original_filename" text,
  "width" integer,
  "height" integer,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "courses_duplicate_of_idx"
  ON "courses" ("duplicate_of_course_id");

CREATE INDEX IF NOT EXISTS "courses_status_image_status_idx"
  ON "courses" ("status", "image_status");

-- 2. Affiliate products (operator-facing commerce entities).
DO $$ BEGIN
  CREATE TYPE "affiliate_merchant" AS ENUM ('SHOPEE', 'LAZADA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "affiliate_product_status" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "affiliate_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "merchant" "affiliate_merchant" NOT NULL,
  "title" text NOT NULL,
  "destination_url" text NOT NULL,
  "merchant_product_id" text,
  "image_url" text,
  "short_description" text,
  "product_category" "commerce_product_group" NOT NULL,
  "display_price" text,
  "original_price" text,
  "currency" text,
  "discount_label" text,
  "shop_name" text,
  "status" "affiliate_product_status" NOT NULL DEFAULT 'INACTIVE',
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "affiliate_provider_id" uuid REFERENCES "affiliate_providers"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "affiliate_product_contexts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "affiliate_products"("id") ON DELETE CASCADE,
  "placement_key" text NOT NULL,
  "course_id" uuid REFERENCES "courses"("id") ON DELETE CASCADE,
  "topic_slug" text,
  "category_slug" text,
  "priority" integer NOT NULL DEFAULT 100,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "affiliate_products_status_merchant_idx"
  ON "affiliate_products" ("status", "merchant");

CREATE INDEX IF NOT EXISTS "affiliate_product_contexts_product_idx"
  ON "affiliate_product_contexts" ("product_id", "enabled");

CREATE INDEX IF NOT EXISTS "affiliate_product_contexts_course_idx"
  ON "affiliate_product_contexts" ("course_id", "enabled");

CREATE INDEX IF NOT EXISTS "affiliate_product_contexts_topic_idx"
  ON "affiliate_product_contexts" ("topic_slug", "enabled");

CREATE INDEX IF NOT EXISTS "affiliate_product_contexts_category_idx"
  ON "affiliate_product_contexts" ("category_slug", "enabled");

-- Optional product_id on clicks for analytics (nullable for legacy campaign clicks).
ALTER TABLE "affiliate_clicks"
  ADD COLUMN IF NOT EXISTS "product_id" uuid
    REFERENCES "affiliate_products"("id") ON DELETE SET NULL;
