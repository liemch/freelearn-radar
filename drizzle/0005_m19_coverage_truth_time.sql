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
