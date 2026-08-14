-- v1.2 remediation (docs/V1_2_REMEDIATION_PLAN.md)
-- Additive and idempotent: safe to re-run, no table rewrites, no data loss.

-- ---------------------------------------------------------------------------
-- R2.4 / DAT-01 — event idempotency at the database
--
-- Detection reads recent events and then inserts, with no transaction between
-- the two, so two concurrent workers can both pass the 24h cooldown check before
-- either commits. Deduplication must therefore be a constraint, not a
-- convention: one confirmed event per course per type per UTC day.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "course_price_events_dedupe_idx"
  ON "course_price_events" ("course_id", "event_type", (date_trunc('day', "confirmed_at")))
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
