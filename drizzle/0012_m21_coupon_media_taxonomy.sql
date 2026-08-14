-- M21 — Coupon discovery, multi-domain coverage, course media, FREE_PREVIEW
-- Additive. Rollback: drop new tables/columns; remove enum values is harder —
-- prefer leave unused enum labels rather than destructive DROP TYPE.

DO $$ BEGIN
  ALTER TYPE "public"."price_type" ADD VALUE IF NOT EXISTS 'FREE_PREVIEW' BEFORE 'FREE_WITH_COUPON';
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."coupon_offer_status" AS ENUM(
    'DISCOVERED',
    'VERIFYING',
    'ACTIVE_100_OFF',
    'ACTIVE_DISCOUNTED',
    'EXPIRED',
    'INVALID',
    'BLOCKED',
    'UNKNOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."coupon_source_type" AS ENUM('HTML', 'RSS', 'API', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."coupon_source_health" AS ENUM(
    'HEALTHY',
    'DEGRADED',
    'FAILING',
    'DISABLED',
    'UNKNOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."course_image_status" AS ENUM(
    'OK',
    'MISSING',
    'BROKEN',
    'FALLBACK',
    'BLOCKED',
    'PENDING'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."course_image_source_type" AS ENUM(
    'OFFICIAL',
    'TRUSTED_METADATA',
    'CACHED',
    'CATEGORY_FALLBACK',
    'PROVIDER_FALLBACK',
    'NONE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Course media enrichment (reuse courses table; no duplicate media entity)
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_resolved_url" text;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_source_type" "public"."course_image_source_type" DEFAULT 'NONE' NOT NULL;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_status" "public"."course_image_status" DEFAULT 'MISSING' NOT NULL;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_width" integer;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_height" integer;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_hash" text;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_fallback_reason" text;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_checked_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "coupon_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "source_key" text NOT NULL,
  "source_type" "public"."coupon_source_type" DEFAULT 'HTML' NOT NULL,
  "base_url" text NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "discovery_only" boolean DEFAULT true NOT NULL,
  "health_status" "public"."coupon_source_health" DEFAULT 'UNKNOWN' NOT NULL,
  "last_run_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "candidates_discovered" integer DEFAULT 0 NOT NULL,
  "verification_success_rate" numeric(5, 4),
  "active_100_off_rate" numeric(5, 4),
  "expired_at_discovery_rate" numeric(5, 4),
  "duplicate_rate" numeric(5, 4),
  "quality_accept_rate" numeric(5, 4),
  "config_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "coupon_sources_source_key_uidx"
  ON "coupon_sources" ("source_key");
CREATE INDEX IF NOT EXISTS "coupon_sources_enabled_priority_idx"
  ON "coupon_sources" ("enabled", "priority");

CREATE TABLE IF NOT EXISTS "coupon_candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid REFERENCES "coupon_sources"("id") ON DELETE SET NULL,
  "provider_slug" text DEFAULT 'udemy' NOT NULL,
  "canonical_url" text NOT NULL,
  "offer_url" text NOT NULL,
  "coupon_code" text,
  "discovered_from" text,
  "discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source_claim" text,
  "source_price" numeric(10, 2),
  "source_original_price" numeric(10, 2),
  "source_expires_at" timestamp with time zone,
  "status" "public"."coupon_offer_status" DEFAULT 'DISCOVERED' NOT NULL,
  "course_id" uuid REFERENCES "courses"("id") ON DELETE SET NULL,
  "last_error" text,
  "raw_payload_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "coupon_candidates_status_discovered_idx"
  ON "coupon_candidates" ("status", "discovered_at");
CREATE INDEX IF NOT EXISTS "coupon_candidates_canonical_url_idx"
  ON "coupon_candidates" ("canonical_url");
CREATE INDEX IF NOT EXISTS "coupon_candidates_coupon_code_idx"
  ON "coupon_candidates" ("coupon_code");

CREATE TABLE IF NOT EXISTS "course_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid REFERENCES "courses"("id") ON DELETE SET NULL,
  "provider_id" uuid REFERENCES "providers"("id") ON DELETE SET NULL,
  "provider_slug" text NOT NULL,
  "canonical_url" text NOT NULL,
  "offer_url" text NOT NULL,
  "coupon_code" text,
  "offer_type" text DEFAULT 'COUPON' NOT NULL,
  "discount_percent" integer,
  "price_after_discount" numeric(10, 2),
  "currency" text,
  "status" "public"."coupon_offer_status" DEFAULT 'DISCOVERED' NOT NULL,
  "discovered_from" text,
  "discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "verified_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "next_recheck_at" timestamp with time zone,
  "last_error" text,
  "candidate_id" uuid REFERENCES "coupon_candidates"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "course_offers_status_verified_idx"
  ON "course_offers" ("status", "verified_at");
CREATE INDEX IF NOT EXISTS "course_offers_course_id_idx"
  ON "course_offers" ("course_id");
CREATE INDEX IF NOT EXISTS "course_offers_next_recheck_idx"
  ON "course_offers" ("next_recheck_at");
CREATE UNIQUE INDEX IF NOT EXISTS "course_offers_offer_url_uidx"
  ON "course_offers" ("offer_url");

CREATE TABLE IF NOT EXISTS "discovery_category_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_slug" text NOT NULL,
  "queries_run" integer DEFAULT 0 NOT NULL,
  "candidates_found" integer DEFAULT 0 NOT NULL,
  "verified_count" integer DEFAULT 0 NOT NULL,
  "published_count" integer DEFAULT 0 NOT NULL,
  "zero_candidate_runs" integer DEFAULT 0 NOT NULL,
  "last_discovered_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "discovery_category_stats_slug_uidx"
  ON "discovery_category_stats" ("category_slug");
CREATE INDEX IF NOT EXISTS "discovery_category_stats_published_idx"
  ON "discovery_category_stats" ("published_count");
