-- M20.1 lexical relevance: unaccent + pg_trgm + immutable wrapper + indexes
-- Additive / idempotent. Safe on Neon when extensions are allowed.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() is STABLE; indexes and generated expressions need IMMUTABLE.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

-- Trigram indexes for typo / partial match on primary text fields.
CREATE INDEX IF NOT EXISTS "courses_title_unaccent_trgm_idx"
  ON "courses" USING gin (public.immutable_unaccent(lower(coalesce("title", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "courses_short_description_unaccent_trgm_idx"
  ON "courses" USING gin (public.immutable_unaccent(lower(coalesce("short_description", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "courses_description_unaccent_trgm_idx"
  ON "courses" USING gin (public.immutable_unaccent(lower(coalesce("description", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "providers_name_unaccent_trgm_idx"
  ON "providers" USING gin (public.immutable_unaccent(lower(coalesce("name", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "topic_tags_name_en_unaccent_trgm_idx"
  ON "topic_tags" USING gin (public.immutable_unaccent(lower(coalesce("name_en", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "topic_tags_name_vi_unaccent_trgm_idx"
  ON "topic_tags" USING gin (public.immutable_unaccent(lower(coalesce("name_vi", ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "categories_name_unaccent_trgm_idx"
  ON "categories" USING gin (public.immutable_unaccent(lower(coalesce("name", ''))) gin_trgm_ops);
