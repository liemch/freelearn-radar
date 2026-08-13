-- M18.2: course image metadata
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_source_url" text;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_storage_url" text;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_last_verified_at" timestamp with time zone;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "image_policy" text DEFAULT 'REMOTE_ONLY';
