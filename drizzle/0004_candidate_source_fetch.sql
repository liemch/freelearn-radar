-- M18.4: persist course source fetch evidence on candidates
ALTER TABLE "course_candidates" ADD COLUMN IF NOT EXISTS "source_evidence_json" jsonb;
ALTER TABLE "course_candidates" ADD COLUMN IF NOT EXISTS "source_fetched_at" timestamp with time zone;
ALTER TABLE "course_candidates" ADD COLUMN IF NOT EXISTS "source_final_url" text;
ALTER TABLE "course_candidates" ADD COLUMN IF NOT EXISTS "source_image_url" text;
