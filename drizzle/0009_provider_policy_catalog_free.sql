-- Coverage track: mark providers whose entire published catalog is free by policy,
-- so a candidate page that simply never mentions price can be classified from the
-- provider policy instead of falling back to UNKNOWN (§66.2 / §66.3).
-- Additive and idempotent.

ALTER TABLE "provider_policies"
  ADD COLUMN IF NOT EXISTS "catalog_wide_free" boolean DEFAULT false NOT NULL;
