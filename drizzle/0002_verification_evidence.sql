-- M16: activate verification history evidence fields + lookup index
ALTER TABLE "course_verifications" ADD COLUMN IF NOT EXISTS "evidence_json" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "course_verifications" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "course_verifications" ADD COLUMN IF NOT EXISTS "change_summary" text;
CREATE INDEX IF NOT EXISTS "course_verifications_course_verified_idx" ON "course_verifications" ("course_id", "verified_at");
