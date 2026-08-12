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
