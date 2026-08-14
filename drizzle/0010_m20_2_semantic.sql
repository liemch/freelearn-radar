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
