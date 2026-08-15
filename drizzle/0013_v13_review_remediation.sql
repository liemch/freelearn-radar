-- v1.3 / v1.3.1 review remediation.
--
-- 1. coupon_candidates.offer_url uniqueness.
--    Duplicate suppression during discovery was a read-then-insert in
--    application code, so two concurrent runs (or a cron retry after a
--    timeout) could both pass the existence check. course_offers already has
--    this constraint; candidates did not.
--
-- 2. Supporting index for the offer_url lookup performed on every discovered
--    candidate.
--
-- Additive and re-runnable. The de-duplication step keeps the earliest row per
-- offer_url, which is the one whose discovered_at reflects first sighting.

-- Collapse pre-existing duplicates before the constraint can be added.
DELETE FROM "coupon_candidates" c
USING "coupon_candidates" keep
WHERE c."offer_url" = keep."offer_url"
  AND (
    keep."discovered_at" < c."discovered_at"
    OR (keep."discovered_at" = c."discovered_at" AND keep."id" < c."id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "coupon_candidates_offer_url_uidx"
  ON "coupon_candidates" ("offer_url");
