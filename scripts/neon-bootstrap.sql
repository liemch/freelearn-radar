-- FreeLearn Radar — manual bootstrap for Neon SQL Editor (FALLBACK ONLY)
--
-- GENERATED FILE — do not edit by hand.
-- Regenerate with: npm run db:bootstrap:generate
-- Source of truth: drizzle/*.sql (ordered by drizzle/meta/_journal.json)
--
-- Prefer the automated deploy instead:
--   vercel-build runs `db:migrate:run` + `db:seed` on each Vercel deploy (idempotent).
--
-- Use this file only when:
--   - deploy bootstrap failed, or
--   - you cannot deploy and need a one-shot SQL paste in Neon SQL Editor.
--
-- Neon SQL Editor: paste the ENTIRE file → Run once (not line by line).
-- Afterwards run `npm run db:seed` to load providers, categories, and queries.

-- ========== MIGRATION 0000_initial_schema ==========
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'EDITOR');
CREATE TYPE "public"."course_status" AS ENUM('DRAFT', 'PUBLISHED', 'EXPIRED', 'UNAVAILABLE', 'ARCHIVED');
CREATE TYPE "public"."price_type" AS ENUM('FREE_FULL', 'FREE_AUDIT', 'FREE_WITH_COUPON', 'TEMPORARILY_FREE', 'FREE_TRIAL', 'PAID', 'UNKNOWN');
CREATE TYPE "public"."certificate_type" AS ENUM('FREE_CERTIFICATE', 'PAID_CERTIFICATE', 'NO_CERTIFICATE', 'UNKNOWN');
CREATE TYPE "public"."course_level" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS', 'UNKNOWN');
CREATE TYPE "public"."discovery_status" AS ENUM('DISCOVERED', 'FETCHED', 'ANALYZED', 'READY_FOR_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'INVALID', 'DUPLICATE', 'EXPIRED', 'ERROR');
CREATE TYPE "public"."source_type" AS ENUM('SEARCH', 'MANUAL');
CREATE TYPE "public"."verification_status" AS ENUM('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');
CREATE TYPE "public"."verification_method" AS ENUM('SEARCH', 'PAGE_METADATA', 'AI', 'MANUAL');

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" "user_role" DEFAULT 'EDITOR' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "providers" (
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

CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text
);

CREATE TABLE "courses" (
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

CREATE TABLE "course_categories" (
  "course_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  CONSTRAINT "course_categories_course_id_category_id_pk" PRIMARY KEY("course_id","category_id")
);

CREATE TABLE "course_candidates" (
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
  "error_message" text
);

CREATE TABLE "course_verifications" (
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

CREATE TABLE "discovery_queries" (
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

CREATE TABLE "outbound_clicks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL,
  "provider_id" uuid NOT NULL,
  "referrer" text,
  "utm_source" text,
  "clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "courses" ADD CONSTRAINT "courses_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_verifications" ADD CONSTRAINT "course_verifications_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "outbound_clicks" ADD CONSTRAINT "outbound_clicks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "outbound_clicks" ADD CONSTRAINT "outbound_clicks_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;

CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");
CREATE UNIQUE INDEX "providers_slug_unique" ON "providers" USING btree ("slug");
CREATE UNIQUE INDEX "providers_domain_unique" ON "providers" USING btree ("domain");
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");
CREATE UNIQUE INDEX "courses_slug_unique" ON "courses" USING btree ("slug");
CREATE UNIQUE INDEX "courses_canonical_url_unique" ON "courses" USING btree ("canonical_url");
CREATE UNIQUE INDEX "course_candidates_canonical_url_unique" ON "course_candidates" USING btree ("canonical_url");

-- ========== MIGRATION 0001_add_query_indexes ==========
CREATE INDEX IF NOT EXISTS "courses_status_published_at_idx"
  ON "courses" ("status", "published_at" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "courses_status_quality_score_idx"
  ON "courses" ("status", "quality_score" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "course_candidates_discovery_status_discovered_at_idx"
  ON "course_candidates" ("discovery_status", "discovered_at" DESC);

CREATE INDEX IF NOT EXISTS "outbound_clicks_course_id_idx"
  ON "outbound_clicks" ("course_id");

CREATE INDEX IF NOT EXISTS "outbound_clicks_provider_id_idx"
  ON "outbound_clicks" ("provider_id");

CREATE INDEX IF NOT EXISTS "outbound_clicks_clicked_at_idx"
  ON "outbound_clicks" ("clicked_at" DESC);

CREATE INDEX IF NOT EXISTS "discovery_queries_enabled_next_run_at_idx"
  ON "discovery_queries" ("enabled", "next_run_at");

-- ========== MIGRATION 0002_verification_evidence ==========
-- M16: activate verification history evidence fields + lookup index
ALTER TABLE "course_verifications" ADD COLUMN IF NOT EXISTS "evidence_json" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "course_verifications" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "course_verifications" ADD COLUMN IF NOT EXISTS "change_summary" text;
CREATE INDEX IF NOT EXISTS "course_verifications_course_verified_idx" ON "course_verifications" ("course_id", "verified_at");

-- ========== MIGRATION 0003_course_images ==========
-- M18.2: course image metadata
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_source_url" text;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_storage_url" text;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_last_verified_at" timestamp with time zone;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_policy" text DEFAULT 'REMOTE_ONLY';

-- ========== MIGRATION 0004_candidate_source_fetch ==========
-- M18.4: persist course source fetch evidence on candidates
ALTER TABLE "course_candidates" ADD COLUMN IF NOT EXISTS "source_evidence_json" jsonb;
ALTER TABLE "course_candidates" ADD COLUMN IF NOT EXISTS "source_fetched_at" timestamp with time zone;
ALTER TABLE "course_candidates" ADD COLUMN IF NOT EXISTS "source_final_url" text;
ALTER TABLE "course_candidates" ADD COLUMN IF NOT EXISTS "source_image_url" text;

-- ========== MIGRATION 0005_m19_coverage_truth_time ==========
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

-- ========== MIGRATION 0006_v12_remediation ==========
-- v1.2 remediation (docs/V1_2_REMEDIATION_PLAN.md)
-- Additive and idempotent: safe to re-run, no table rewrites, no data loss.

-- ---------------------------------------------------------------------------
-- R2.4 / DAT-01 — event idempotency at the database
--
-- Detection reads recent events and then inserts, with no transaction between
-- the two, so two concurrent workers can both pass the 24h cooldown check before
-- either commits. Deduplication must therefore be a constraint, not a
-- convention: one confirmed event per course per type per UTC day.
--
-- Any duplicate already in the table would block the unique index, so they are
-- collapsed first. These rows are the bug's output, not distinct history: each
-- records the same transition, for the same course, on the same day. The
-- earliest is kept because it is when the change was actually first confirmed,
-- and the detection itself remains traceable in admin_audit_log either way.
-- ---------------------------------------------------------------------------
DELETE FROM "course_price_events" AS e
USING (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY
        "course_id",
        "event_type",
        date_trunc('day', "confirmed_at" AT TIME ZONE 'UTC')
      ORDER BY "confirmed_at", "id"
    ) AS rn
  FROM "course_price_events"
  WHERE "confirmed_at" IS NOT NULL
) AS d
WHERE e."id" = d."id" AND d.rn > 1;

-- `date_trunc(text, timestamptz)` is STABLE, not IMMUTABLE — it reads the
-- session TimeZone — and Postgres refuses a non-immutable function in an index
-- expression. Pinning the zone makes it immutable and also states the intent
-- the comment above already claimed: one event per UTC day, not per the
-- timezone whichever connection happens to be set to.
CREATE UNIQUE INDEX IF NOT EXISTS "course_price_events_dedupe_idx"
  ON "course_price_events" (
    "course_id",
    "event_type",
    (date_trunc('day', "confirmed_at" AT TIME ZONE 'UTC'))
  )
  WHERE "confirmed_at" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- R3 / DAT-03 — tracker ordering
--
-- The public tracker orders by confirmed_at DESC; the existing composite stops
-- at event_type.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "course_price_events_course_type_confirmed_idx"
  ON "course_price_events" ("course_id", "event_type", "confirmed_at" DESC);

-- ---------------------------------------------------------------------------
-- R2.6 / DAT-03 — watch token lookups
--
-- Confirmation and unsubscribe both look a token up directly. Without an index
-- every click is a sequential scan.
--
-- NOTE: tokens are stored hashed from this release onward (SEC-02). Any token
-- issued before this migration no longer validates. Price alerts have never been
-- enabled in production (FEATURE_PRICE_ALERTS defaults off, EMAIL_DRY_RUN
-- defaults true), so no delivered link is affected; if that assumption is wrong
-- for a given deployment, affected subscribers simply re-subscribe.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "course_watches_confirm_token_idx"
  ON "course_watches" ("confirm_token");

CREATE INDEX IF NOT EXISTS "course_watches_unsubscribe_token_idx"
  ON "course_watches" ("unsubscribe_token");

-- ========== MIGRATION 0007_m20_foundation ==========
-- M20.0 foundation: search instrumentation + evaluation scaffolding
-- Additive and idempotent. Table never existed in this repo — CREATE, not ALTER-only.

DO $$ BEGIN
  CREATE TYPE "public"."search_retrieval_mode" AS ENUM('LEXICAL', 'SEMANTIC', 'HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."search_query_language" AS ENUM('EN', 'VI', 'VI_NO_DIACRITIC', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."search_eval_locale" AS ENUM('EN', 'VI', 'VI_NO_DIACRITIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."search_eval_group" AS ENUM(
    'EXACT',
    'KEYWORD',
    'NL',
    'CONSTRAINT',
    'CROSS_LANG',
    'NEGATIVE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "search_queries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "query_hash" text NOT NULL,
  "normalized_query" text,
  "locale" text,
  "query_language" "search_query_language" DEFAULT 'UNKNOWN' NOT NULL,
  "result_count" integer DEFAULT 0 NOT NULL,
  "zero_result" boolean DEFAULT false NOT NULL,
  "clicked_course_id" uuid,
  "filters_json" jsonb,
  "latency_ms" integer,
  "retrieval_mode" "search_retrieval_mode" DEFAULT 'LEXICAL' NOT NULL,
  "degraded" boolean DEFAULT false NOT NULL,
  "top_score" numeric(8, 4),
  "unmet_intent" boolean DEFAULT false NOT NULL,
  "lexical_would_be_zero" boolean,
  "ranking_config_version" text,
  "session_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_clicked_course_id_courses_id_fk"
    FOREIGN KEY ("clicked_course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "search_queries_created_at_idx"
  ON "search_queries" ("created_at");
CREATE INDEX IF NOT EXISTS "search_queries_query_hash_created_at_idx"
  ON "search_queries" ("query_hash", "created_at");
CREATE INDEX IF NOT EXISTS "search_queries_zero_result_created_at_idx"
  ON "search_queries" ("zero_result", "created_at");
CREATE INDEX IF NOT EXISTS "search_queries_unmet_intent_created_at_idx"
  ON "search_queries" ("unmet_intent", "created_at");

CREATE TABLE IF NOT EXISTS "search_evaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dataset_version" text NOT NULL,
  "catalog_snapshot_id" text,
  "query_id" text NOT NULL,
  "locale" "search_eval_locale" NOT NULL,
  "query_group" "search_eval_group" NOT NULL,
  "query_text" text NOT NULL,
  "expected_labels_json" jsonb,
  "annotator_agreement" numeric(5, 4),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "search_evaluations_dataset_query_uidx"
  ON "search_evaluations" ("dataset_version", "query_id");
CREATE INDEX IF NOT EXISTS "search_evaluations_dataset_version_idx"
  ON "search_evaluations" ("dataset_version");

CREATE TABLE IF NOT EXISTS "search_benchmark_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dataset_version" text NOT NULL,
  "retrieval_mode" "search_retrieval_mode" NOT NULL,
  "ranking_config_version" text,
  "embedding_model" text,
  "ndcg_at_10" numeric(8, 4),
  "precision_at_5" numeric(8, 4),
  "exact_title_success" numeric(8, 4),
  "latency_p95" integer,
  "cost_estimate" numeric(10, 6),
  "label_decay_rate" numeric(5, 4),
  "metrics_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "search_benchmark_runs_created_at_idx"
  ON "search_benchmark_runs" ("created_at");
CREATE INDEX IF NOT EXISTS "search_benchmark_runs_dataset_mode_idx"
  ON "search_benchmark_runs" ("dataset_version", "retrieval_mode");

-- ========== MIGRATION 0008_m20_1_lexical ==========
-- M20.1 lexical relevance: unaccent + pg_trgm + immutable wrapper + indexes
-- Additive / idempotent. Safe on Neon when extensions are allowed.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() is STABLE; indexes and generated expressions need IMMUTABLE.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

-- Trigram indexes for typo / partial match on primary text fields.
CREATE INDEX IF NOT EXISTS "courses_title_unaccent_trgm_idx"
  ON "courses" USING gin (public.immutable_unaccent(lower(coalesce("title", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "courses_short_description_unaccent_trgm_idx"
  ON "courses" USING gin (public.immutable_unaccent(lower(coalesce("short_description", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "courses_description_unaccent_trgm_idx"
  ON "courses" USING gin (public.immutable_unaccent(lower(coalesce("description", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "providers_name_unaccent_trgm_idx"
  ON "providers" USING gin (public.immutable_unaccent(lower(coalesce("name", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "topic_tags_name_en_unaccent_trgm_idx"
  ON "topic_tags" USING gin (public.immutable_unaccent(lower(coalesce("name_en", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "topic_tags_name_vi_unaccent_trgm_idx"
  ON "topic_tags" USING gin (public.immutable_unaccent(lower(coalesce("name_vi", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "categories_name_unaccent_trgm_idx"
  ON "categories" USING gin (public.immutable_unaccent(lower(coalesce("name", ''))) gin_trgm_ops);

-- ========== MIGRATION 0009_provider_policy_catalog_free ==========
-- Coverage track: mark providers whose entire published catalog is free by policy,
-- so a candidate page that simply never mentions price can be classified from the
-- provider policy instead of falling back to UNKNOWN (§66.2 / §66.3).
-- Additive and idempotent.

ALTER TABLE "provider_policies"
  ADD COLUMN IF NOT EXISTS "catalog_wide_free" boolean DEFAULT false NOT NULL;

-- ========== MIGRATION 0010_m20_2_semantic ==========
-- M20.2 semantic search foundation: pgvector + course_embeddings + query cache
-- Additive / idempotent. Requires Neon pgvector support.

CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
  CREATE TYPE "public"."embedding_status" AS ENUM('PENDING', 'OK', 'FAILED', 'STALE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "course_embeddings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "embedding" vector(1024),
  "embedding_model" text NOT NULL,
  "embedding_version" text NOT NULL,
  "semantic_document_version" text NOT NULL,
  "content_hash" text NOT NULL,
  "embedded_at" timestamp with time zone,
  "status" "public"."embedding_status" DEFAULT 'PENDING' NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_embeddings_course_model_version_uidx"
  ON "course_embeddings" ("course_id", "embedding_model", "embedding_version");

CREATE INDEX IF NOT EXISTS "course_embeddings_status_idx"
  ON "course_embeddings" ("status");

CREATE INDEX IF NOT EXISTS "course_embeddings_model_version_status_idx"
  ON "course_embeddings" ("embedding_model", "embedding_version", "status");

CREATE TABLE IF NOT EXISTS "query_embedding_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "query_hash" text NOT NULL,
  "embedding_model" text NOT NULL,
  "embedding_version" text NOT NULL,
  "embedding" vector(1024) NOT NULL,
  "hit_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "query_embedding_cache_hash_model_version_uidx"
  ON "query_embedding_cache" ("query_hash", "embedding_model", "embedding_version");

-- ========== MIGRATION 0011_m20_12_monetization ==========
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

-- ========== MIGRATION 0012_m21_coupon_media_taxonomy ==========
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

-- ========== MIGRATION 0013_v13_review_remediation ==========
-- v1.3 / v1.3.1 review remediation.
--
-- 1. coupon_candidates.offer_url uniqueness.
--    Duplicate suppression during discovery was a read-then-insert in
--    application code, so two concurrent runs (or a cron retry after a
--    timeout) could both pass the existence check. course_offers already has
--    this constraint; candidates did not.
--
-- 2. Supporting index for the offer_url lookup performed on every discovered
--    candidate.
--
-- Additive and re-runnable. The de-duplication step keeps the earliest row per
-- offer_url, which is the one whose discovered_at reflects first sighting.

-- Collapse pre-existing duplicates before the constraint can be added.
DELETE FROM "coupon_candidates" c
USING "coupon_candidates" keep
WHERE c."offer_url" = keep."offer_url"
  AND (
    keep."discovered_at" < c."discovered_at"
    OR (keep."discovered_at" = c."discovered_at" AND keep."id" < c."id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "coupon_candidates_offer_url_uidx"
  ON "coupon_candidates" ("offer_url");

-- ========== MIGRATION 0014_m22_site_branding ==========
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

-- ========== MIGRATION 0015_m23_media_lifecycle_affiliate ==========
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

-- ========== MIGRATION 0016_m24_managed_assets ==========
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

-- ========== DRIZZLE MIGRATION TRACKING ==========
CREATE SCHEMA IF NOT EXISTS "drizzle";
CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT 'b08add4492a300a58b6d7959bb6e3529db24d1dc19b577605d1b5d64e2dfb39f', 1723449600000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'b08add4492a300a58b6d7959bb6e3529db24d1dc19b577605d1b5d64e2dfb39f');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT '5d67fb13aad149afcd1cb813600abc0e8a3284010f26b72071e5f5af251e2bb4', 1723536000000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '5d67fb13aad149afcd1cb813600abc0e8a3284010f26b72071e5f5af251e2bb4');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT '9539bd8062647a58e4616fda0413652fc3dda86d42ab85dedbbbb82a5d4c12a4', 1723622400000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '9539bd8062647a58e4616fda0413652fc3dda86d42ab85dedbbbb82a5d4c12a4');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT '9b5585cc468d77c20518fea79209aaa6379e3581cfc20b618d35ad77a3883fbf', 1723708800000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '9b5585cc468d77c20518fea79209aaa6379e3581cfc20b618d35ad77a3883fbf');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT 'b42f9dbd2e47c2eb515142098eccf47631254bbc1aac3c0e048707e7e7804e34', 1723795200000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'b42f9dbd2e47c2eb515142098eccf47631254bbc1aac3c0e048707e7e7804e34');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT 'a2086074093d7f04d662a21dd67da362578f5dfd5ab66da3e96202abbad6002f', 1723881600000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'a2086074093d7f04d662a21dd67da362578f5dfd5ab66da3e96202abbad6002f');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT '0b490ccc4b865cf972f607ec84a453e670b5443f9bc7177cd7cbc6902f5118ea', 1723968000000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '0b490ccc4b865cf972f607ec84a453e670b5443f9bc7177cd7cbc6902f5118ea');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT 'aaf369d3a08b1dbb819ab27817ccba32424323aaf81c56c27a37503f0d57f8ee', 1724054400000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'aaf369d3a08b1dbb819ab27817ccba32424323aaf81c56c27a37503f0d57f8ee');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT '3c4522bd9b56659d835859e6634a6e19aa9266a0a022d33a50ff3788bb9d21ba', 1724140800000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '3c4522bd9b56659d835859e6634a6e19aa9266a0a022d33a50ff3788bb9d21ba');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT '79aa4ad71d2926277b05521a39006d5c02d62e57c32769c06ee2d695faf562d9', 1724227200000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '79aa4ad71d2926277b05521a39006d5c02d62e57c32769c06ee2d695faf562d9');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT 'a45128de981468cf13189e1fa2a685a33cacee5da70fa9586f6ad1cda598ec53', 1724313600000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'a45128de981468cf13189e1fa2a685a33cacee5da70fa9586f6ad1cda598ec53');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT '7116fd6d8c2815afafbe77106390fd8a82258a6dc91f275a22b61bd1f6d49ebb', 1724400000000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '7116fd6d8c2815afafbe77106390fd8a82258a6dc91f275a22b61bd1f6d49ebb');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT 'aac276b90b021b84c154c8e53b2821af0800ba4dc3a74a03d95dec20a9ddd5d0', 1724486400000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'aac276b90b021b84c154c8e53b2821af0800ba4dc3a74a03d95dec20a9ddd5d0');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT 'e2091585b7e446dd3970557508b6ae81d352cbdabdb47b12107c827b96b70451', 1724572800000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'e2091585b7e446dd3970557508b6ae81d352cbdabdb47b12107c827b96b70451');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT '87382410761e3ecf36c73951431156eab204e46883586aca9fac73ec3cc97510', 1724659200000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '87382410761e3ecf36c73951431156eab204e46883586aca9fac73ec3cc97510');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT '5a2e326f93af791214cccf8e0393edc74ef51b73123d0e7427bfb8f8c25d8e95', 1724745600000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '5a2e326f93af791214cccf8e0393edc74ef51b73123d0e7427bfb8f8c25d8e95');
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT 'cd4584809f1f5ebf03468a91d8c1ffa9b9b20d888c6cd6c719f79ca7bf04eb6c', 1724832000000
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = 'cd4584809f1f5ebf03468a91d8c1ffa9b9b20d888c6cd6c719f79ca7bf04eb6c');

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
-- Intentionally omitted. The query set is large and changes often; running
-- `npm run db:seed` keeps it in step with src/db/seed/data.ts instead of
-- drifting inside this file.

-- ========== SEED: admin user ==========
-- Email: admin@example.com | Password: FreeLearnRadar2026!
-- Change this password immediately after first login.
INSERT INTO "users" ("email", "name", "password_hash", "role")
VALUES (
  'admin@example.com',
  'Admin',
  '$2b$12$/RzasQ3Re0V3P9FzmgmxT.FzRI7ogGlrqzuTqrsLZK2xvw3vtgkLu',
  'ADMIN'
)
ON CONFLICT ("email") DO NOTHING;
