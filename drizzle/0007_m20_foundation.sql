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
