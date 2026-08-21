-- Session revocation: the admin JWT is self-contained, so deleting a user or
-- demoting them left their existing cookie valid until it expired. Requests now
-- re-read this counter, which gives operators a revoke lever that does not
-- require rotating AUTH_SECRET for everyone.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 1 NOT NULL;
