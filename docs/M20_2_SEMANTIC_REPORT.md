# M20.2 — Semantic Search Foundation Report

Status: **SHIPPED behind flags (all OFF by default)** (2026-08-14)

## What shipped

- `pgvector` embedding storage: `course_embeddings` table
  (`drizzle/0010_m20_2_semantic.sql`), one row per course + model version.
- Semantic document builder (`src/domain/embedding/semantic-document.ts`):
  facts-only text (never raw HTML, scores, or internal evidence),
  versioned (`semdoc-v1`) and content-hashed for idempotent re-embedding.
- Embedding pipeline (`src/domain/embedding/embed-batch.ts`) with provider
  abstraction (`src/services/embedding/embedding-provider.ts`), NVIDIA
  `nv-embedqa-e5-v5` (1024-dim) as default, `FakeEmbeddingProvider` for tests.
  Cron entry: `/api/cron/embed`; admin backfill: `/api/admin/embeddings`.
- Semantic retrieval (`src/domain/search/semantic.ts`) with query-embedding
  cache and hard timeouts (`VECTOR_QUERY_TIMEOUT_MS`, degrade to lexical).
- Hybrid retrieval (`src/domain/search/hybrid.ts`): lexical + semantic → RRF
  (`src/domain/search/fusion.ts`, k=60) → free-list truth filter.
- Model decision recorded in `ADR_EMBEDDING_MODEL.md`.

## Verification

- Unit tests: semantic document determinism/hashing, RRF determinism and
  floor, fake-provider vectors (`m20-search.test.ts`,
  `semantic-document.test.ts`, `fusion.test.ts`).
- Degradation contract: any semantic failure or timeout falls back to the
  lexical path; the search page never hard-fails on embedding issues.

## Honest limits

- NDCG / precision gates are **N/A**: the published catalog is ~1 course
  (Gate B), so relevance metrics are not measurable. See
  `STOP_1_SEARCH_QUALITY.md`.
- Embedding coverage of the catalog is trivially achievable now but
  meaningless as a quality signal until the catalog grows.
- `FEATURE_SEMANTIC_SEARCH` and `FEATURE_HYBRID_SEARCH` stay OFF until the
  staged rollout criteria in `M20_11_STAGED_ROLLOUT.md` are met.
