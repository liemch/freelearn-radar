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
