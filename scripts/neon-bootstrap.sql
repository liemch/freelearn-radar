-- FreeLearn Radar — manual bootstrap for Neon SQL Editor (FALLBACK ONLY)
--
-- Prefer automated deploy instead:
--   vercel-build runs `db:migrate:run` + `db:seed` on each Vercel deploy (idempotent).
--
-- Use this file only when:
--   - deploy bootstrap failed, or
--   - you cannot deploy and need a one-shot SQL paste in Neon SQL Editor.
--
-- Neon SQL Editor: paste the ENTIRE file → Run once (not line by line).

-- ========== MIGRATIONS (0000) ==========
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'EDITOR');
CREATE TYPE "public"."course_status" AS ENUM('DRAFT', 'PUBLISHED', 'EXPIRED', 'UNAVAILABLE', 'ARCHIVED');
CREATE TYPE "public"."price_type" AS ENUM('FREE_FULL', 'FREE_AUDIT', 'FREE_WITH_COUPON', 'TEMPORARILY_FREE', 'FREE_TRIAL', 'PAID', 'UNKNOWN');
CREATE TYPE "public"."certificate_type" AS ENUM('FREE_CERTIFICATE', 'PAID_CERTIFICATE', 'NO_CERTIFICATE', 'UNKNOWN');
CREATE TYPE "public"."course_level" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS', 'UNKNOWN');
CREATE TYPE "public"."discovery_status" AS ENUM('DISCOVERED', 'FETCHED', 'ANALYZED', 'READY_FOR_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'INVALID', 'DUPLICATE', 'EXPIRED', 'ERROR');
CREATE TYPE "public"."source_type" AS ENUM('SEARCH', 'MANUAL');
CREATE TYPE "public"."verification_status" AS ENUM('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');
CREATE TYPE "public"."verification_method" AS ENUM('SEARCH', 'PAGE_METADATA', 'AI', 'MANUAL');

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" "user_role" DEFAULT 'EDITOR' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "domain" text NOT NULL,
  "logo_url" text,
  "affiliate_enabled" boolean DEFAULT false NOT NULL,
  "affiliate_template" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text
);

CREATE TABLE IF NOT EXISTS "courses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "short_description" text,
  "description" text,
  "provider_id" uuid NOT NULL,
  "canonical_url" text NOT NULL,
  "outbound_url" text NOT NULL,
  "affiliate_url" text,
  "instructor" text,
  "language" text,
  "level" "course_level" DEFAULT 'UNKNOWN' NOT NULL,
  "duration_minutes" integer,
  "price_type" "price_type" DEFAULT 'UNKNOWN' NOT NULL,
  "original_price" numeric(10, 2),
  "current_price" numeric(10, 2),
  "currency" text,
  "certificate_type" "certificate_type" DEFAULT 'UNKNOWN' NOT NULL,
  "rating" numeric(3, 2),
  "rating_count" integer,
  "ai_score" integer,
  "editor_score" integer,
  "quality_score" integer,
  "status" "course_status" DEFAULT 'DRAFT' NOT NULL,
  "published_at" timestamp with time zone,
  "last_verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "course_categories" (
  "course_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  CONSTRAINT "course_categories_course_id_category_id_pk" PRIMARY KEY("course_id","category_id")
);

CREATE TABLE IF NOT EXISTS "course_candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_type" "source_type" DEFAULT 'SEARCH' NOT NULL,
  "search_query" text,
  "source_url" text NOT NULL,
  "canonical_url" text NOT NULL,
  "raw_title" text,
  "raw_description" text,
  "raw_content" text,
  "provider" text,
  "discovery_status" "discovery_status" DEFAULT 'DISCOVERED' NOT NULL,
  "ai_analysis_json" jsonb,
  "confidence" numeric(4, 3),
  "discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "analyzed_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "error_message" text,
  "source_evidence_json" jsonb,
  "source_fetched_at" timestamp with time zone,
  "source_final_url" text,
  "source_image_url" text
);

CREATE TABLE IF NOT EXISTS "course_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL,
  "status" "verification_status" DEFAULT 'PENDING' NOT NULL,
  "price_type" "price_type",
  "price" numeric(10, 2),
  "certificate_type" "certificate_type",
  "evidence_url" text,
  "verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "verification_method" "verification_method" NOT NULL
);

CREATE TABLE IF NOT EXISTS "discovery_queries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "category" text NOT NULL,
  "query" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_run_at" timestamp with time zone,
  "next_run_at" timestamp with time zone,
  "success_count" integer DEFAULT 0 NOT NULL,
  "failure_count" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "outbound_clicks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL,
  "provider_id" uuid NOT NULL,
  "referrer" text,
  "utm_source" text,
  "clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "courses" ADD CONSTRAINT "courses_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "course_verifications" ADD CONSTRAINT "course_verifications_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "outbound_clicks" ADD CONSTRAINT "outbound_clicks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "outbound_clicks" ADD CONSTRAINT "outbound_clicks_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "providers_slug_unique" ON "providers" USING btree ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "providers_domain_unique" ON "providers" USING btree ("domain");
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_unique" ON "categories" USING btree ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "courses_slug_unique" ON "courses" USING btree ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "courses_canonical_url_unique" ON "courses" USING btree ("canonical_url");
CREATE UNIQUE INDEX IF NOT EXISTS "course_candidates_canonical_url_unique" ON "course_candidates" USING btree ("canonical_url");

-- ========== MIGRATIONS (0001) ==========
CREATE INDEX IF NOT EXISTS "courses_status_published_at_idx" ON "courses" ("status", "published_at" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS "courses_status_quality_score_idx" ON "courses" ("status", "quality_score" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS "course_candidates_discovery_status_discovered_at_idx" ON "course_candidates" ("discovery_status", "discovered_at" DESC);
CREATE INDEX IF NOT EXISTS "outbound_clicks_course_id_idx" ON "outbound_clicks" ("course_id");
CREATE INDEX IF NOT EXISTS "outbound_clicks_provider_id_idx" ON "outbound_clicks" ("provider_id");
CREATE INDEX IF NOT EXISTS "outbound_clicks_clicked_at_idx" ON "outbound_clicks" ("clicked_at" DESC);
CREATE INDEX IF NOT EXISTS "discovery_queries_enabled_next_run_at_idx" ON "discovery_queries" ("enabled", "next_run_at");

-- ========== MIGRATIONS (0002) ==========
ALTER TABLE "course_verifications" ADD COLUMN IF NOT EXISTS "evidence_json" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "course_verifications" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "course_verifications" ADD COLUMN IF NOT EXISTS "change_summary" text;
CREATE INDEX IF NOT EXISTS "course_verifications_course_verified_idx" ON "course_verifications" ("course_id", "verified_at");

-- ========== DRIZZLE MIGRATION TRACKING ==========
CREATE SCHEMA IF NOT EXISTS "drizzle";
CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT 'e19d994c15aa446daaa43ef9ceb49b4f1ef0157be7ba025e134df31abd0d2b5a', 1723449600000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'e19d994c15aa446daaa43ef9ceb49b4f1ef0157be7ba025e134df31abd0d2b5a');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT '3a2f50159856b92acffc170a058e84004572120e37e215e0e2cc9560ec097d7f', 1723536000000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '3a2f50159856b92acffc170a058e84004572120e37e215e0e2cc9560ec097d7f');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT 'b633f43170c93e82a5543eeef2cf399bfa6e5663b4f336842d24a34b322970da', 1723622400000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'b633f43170c93e82a5543eeef2cf399bfa6e5663b4f336842d24a34b322970da');

-- ========== SEED: providers ==========
INSERT INTO "providers" ("name", "slug", "domain") VALUES
  ('Coursera', 'coursera', 'coursera.org'),
  ('Udemy', 'udemy', 'udemy.com'),
  ('edX', 'edx', 'edx.org'),
  ('Microsoft Learn', 'microsoft-learn', 'learn.microsoft.com'),
  ('freeCodeCamp', 'freecodecamp', 'freecodecamp.org'),
  ('AWS', 'aws', 'aws.amazon.com'),
  ('Google', 'google', 'developers.google.com'),
  ('LinkedIn Learning', 'linkedin-learning', 'linkedin.com')
ON CONFLICT ("slug") DO NOTHING;

-- ========== SEED: categories ==========
INSERT INTO "categories" ("name", "slug", "description") VALUES
  ('Artificial Intelligence', 'ai', 'Free artificial intelligence courses curated by FreeLearn Radar.'),
  ('Programming', 'programming', 'Free programming courses curated by FreeLearn Radar.'),
  ('Data Science', 'data-science', 'Free data science courses curated by FreeLearn Radar.'),
  ('Cybersecurity', 'cybersecurity', 'Free cybersecurity courses curated by FreeLearn Radar.'),
  ('Cloud', 'cloud', 'Free cloud courses curated by FreeLearn Radar.'),
  ('DevOps', 'devops', 'Free devops courses curated by FreeLearn Radar.'),
  ('Project Management', 'project-management', 'Free project management courses curated by FreeLearn Radar.'),
  ('Product Management', 'product-management', 'Free product management courses curated by FreeLearn Radar.'),
  ('Business', 'business', 'Free business courses curated by FreeLearn Radar.'),
  ('Marketing', 'marketing', 'Free marketing courses curated by FreeLearn Radar.'),
  ('Design', 'design', 'Free design courses curated by FreeLearn Radar.'),
  ('Soft Skills', 'soft-skills', 'Free soft skills courses curated by FreeLearn Radar.')
ON CONFLICT ("slug") DO NOTHING;

-- ========== SEED: discovery queries ==========
INSERT INTO "discovery_queries" ("provider", "category", "query") VALUES
  ('coursera', 'ai', 'site:coursera.org/learn "free" artificial intelligence course'),
  ('udemy', 'programming', 'site:udemy.com/course "free" python course'),
  ('edx', 'cybersecurity', 'site:edx.org/learn cybersecurity free course'),
  ('microsoft-learn', 'cloud', 'site:learn.microsoft.com AI learning path'),
  ('freecodecamp', 'data-science', 'site:freecodecamp.org learn data analysis');

-- ========== SEED: admin user ==========
-- Email: admin@example.com | Password: FreeLearnRadar2026!
INSERT INTO "users" ("email", "name", "password_hash", "role")
VALUES (
  'admin@example.com',
  'Admin',
  '$2b$12$/RzasQ3Re0V3P9FzmgmxT.FzRI7ogGlrqzuTqrsLZK2xvw3vtgkLu',
  'ADMIN'
)
ON CONFLICT ("email") DO NOTHING;

-- ========== M19 (0005) ==========
-- M19: coverage / truth / time schema foundation

-- Extend existing enum
ALTER TYPE "public"."discovery_status" ADD VALUE IF NOT EXISTS 'EXPIRED_UNREVIEWED';

-- New enums
DO $$ BEGIN
  CREATE TYPE "public"."free_durability" AS ENUM('PERMANENT', 'AUDIT_FOREVER', 'LIMITED', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."tracking_tier" AS ENUM('HIGH', 'NORMAL', 'LOW', 'DORMANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."observation_fetch_status" AS ENUM('OK', 'NOT_FOUND', 'BLOCKED', 'TIMEOUT', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."price_event_type" AS ENUM('WENT_FREE', 'WENT_PAID', 'PRICE_CHANGED', 'CERT_CHANGED', 'DELISTED', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."watch_status" AS ENUM('PENDING', 'CONFIRMED', 'NOTIFIED', 'UNSUBSCRIBED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."audit_actor_type" AS ENUM('USER', 'WORKER', 'CRON', 'AI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."extraction_method" AS ENUM('JSON_LD', 'OG', 'HTML_META', 'PROVIDER_API', 'SEARCH', 'AI', 'MANUAL', 'POLICY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Alter existing tables
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "free_durability" "free_durability" DEFAULT 'UNKNOWN' NOT NULL;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "tracking_tier" "tracking_tier" DEFAULT 'NORMAL' NOT NULL;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "last_observed_at" timestamp with time zone;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "next_observation_at" timestamp with time zone;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "volatility_score" numeric(8, 4);
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "free_streak_started_at" timestamp with time zone;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "typical_price_amount" numeric(10, 2);

ALTER TABLE "discovery_queries" ADD COLUMN IF NOT EXISTS "junk_rate" numeric(5, 4);
ALTER TABLE "discovery_queries" ADD COLUMN IF NOT EXISTS "last_junk_review_at" timestamp with time zone;

-- provider_policies
CREATE TABLE IF NOT EXISTS "provider_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" uuid NOT NULL,
  "price_type" "price_type" NOT NULL,
  "certificate_type" "certificate_type" NOT NULL,
  "evidence_url" text,
  "policy_note" text,
  "effective_from" timestamp with time zone,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "provider_policies" ADD CONSTRAINT "provider_policies_provider_id_providers_id_fk"
    FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "provider_policies_provider_id_idx" ON "provider_policies" ("provider_id");
CREATE INDEX IF NOT EXISTS "provider_policies_provider_price_active_idx" ON "provider_policies" ("provider_id", "price_type", "active");

-- admin_audit_log
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_type" "audit_actor_type" NOT NULL,
  "actor_id" text,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "before_json" jsonb,
  "after_json" jsonb,
  "reason" text,
  "request_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "admin_audit_log_entity_type_entity_id_idx" ON "admin_audit_log" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "admin_audit_log_created_at_idx" ON "admin_audit_log" ("created_at");

-- discovery_rejections
CREATE TABLE IF NOT EXISTS "discovery_rejections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discovery_query_id" uuid,
  "url" text NOT NULL,
  "reason" text NOT NULL,
  "matched_rule" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "discovery_rejections" ADD CONSTRAINT "discovery_rejections_discovery_query_id_discovery_queries_id_fk"
    FOREIGN KEY ("discovery_query_id") REFERENCES "public"."discovery_queries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "discovery_rejections_discovery_query_id_idx" ON "discovery_rejections" ("discovery_query_id");
CREATE INDEX IF NOT EXISTS "discovery_rejections_created_at_idx" ON "discovery_rejections" ("created_at");

-- topic_tags + course_topic_tags
CREATE TABLE IF NOT EXISTS "topic_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name_en" text NOT NULL,
  "name_vi" text NOT NULL,
  "category_id" uuid,
  "source" text,
  "course_count" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "topic_tags" ADD CONSTRAINT "topic_tags_category_id_categories_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "topic_tags_slug_unique" ON "topic_tags" ("slug");

CREATE TABLE IF NOT EXISTS "course_topic_tags" (
  "course_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "confidence" numeric(4, 3),
  "source" text,
  CONSTRAINT "course_topic_tags_course_id_tag_id_pk" PRIMARY KEY("course_id","tag_id")
);

DO $$ BEGIN
  ALTER TABLE "course_topic_tags" ADD CONSTRAINT "course_topic_tags_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "course_topic_tags" ADD CONSTRAINT "course_topic_tags_tag_id_topic_tags_id_fk"
    FOREIGN KEY ("tag_id") REFERENCES "public"."topic_tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- course_observations
CREATE TABLE IF NOT EXISTS "course_observations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL,
  "observed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "fetch_status" "observation_fetch_status" NOT NULL,
  "http_status" integer,
  "final_url" text,
  "content_hash" text,
  "etag" text,
  "price_type" "price_type",
  "price_amount" numeric(10, 2),
  "currency" text,
  "observed_region" text,
  "certificate_type" "certificate_type",
  "enrollment_open" boolean,
  "evidence_url" text,
  "evidence_snippet" text,
  "extraction_method" "extraction_method",
  "confidence" numeric(4, 3),
  "fetch_policy_used" text,
  "worker_version" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "course_observations" ADD CONSTRAINT "course_observations_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "course_observations_course_observed_at_idx" ON "course_observations" ("course_id", "observed_at");

-- course_price_events
CREATE TABLE IF NOT EXISTS "course_price_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL,
  "event_type" "price_event_type" NOT NULL,
  "from_state" jsonb,
  "to_state" jsonb,
  "first_seen_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "confirming_observation_ids" jsonb,
  "region" text,
  "is_public" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "course_price_events" ADD CONSTRAINT "course_price_events_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "course_price_events_course_id_idx" ON "course_price_events" ("course_id");
CREATE INDEX IF NOT EXISTS "course_price_events_course_event_type_idx" ON "course_price_events" ("course_id", "event_type");

-- course_watches
CREATE TABLE IF NOT EXISTS "course_watches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL,
  "email" text NOT NULL,
  "locale" text,
  "status" "watch_status" DEFAULT 'PENDING' NOT NULL,
  "confirm_token" text,
  "unsubscribe_token" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "confirmed_at" timestamp with time zone,
  "notified_at" timestamp with time zone
);

DO $$ BEGIN
  ALTER TABLE "course_watches" ADD CONSTRAINT "course_watches_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "course_watches_course_id_idx" ON "course_watches" ("course_id");
CREATE UNIQUE INDEX IF NOT EXISTS "course_watches_course_id_email_unique" ON "course_watches" ("course_id", "email");

-- api_usage_log
CREATE TABLE IF NOT EXISTS "api_usage_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "provider" text,
  "operation" text,
  "course_id" uuid,
  "domain" text,
  "http_status" integer,
  "ok" boolean,
  "latency_ms" integer,
  "units" integer,
  "cost_usd" numeric(10, 6),
  "worker_version" text,
  "error" text,
  "meta_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "api_usage_log" ADD CONSTRAINT "api_usage_log_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "api_usage_log_kind_created_at_idx" ON "api_usage_log" ("kind", "created_at");
CREATE INDEX IF NOT EXISTS "api_usage_log_created_at_idx" ON "api_usage_log" ("created_at");
