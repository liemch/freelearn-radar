# ADR — Embedding model for M20.2

Status: **Accepted**  
Date: 2026-08-14

## Context

M20.2 requires a multilingual (VI ↔ EN) embedding model chosen before any
production backfill. Re-picking later forces a full catalog re-embed.

Candidates compared on `data/search-eval/v1/queries.json` stub pairs
(EN keyword, VI with diacritics, VI without diacritics):

| Candidate | Dim | Notes |
|-----------|-----|--------|
| A `nvidia/nv-embedqa-e5-v5` | 1024 | OpenAI-compatible via NVIDIA NIM; reuses `NVIDIA_API_KEY` |
| B `text-embedding-3-small` | 1536 | Strong multilingual baseline; separate provider key |

Catalog is thin (Gate B CATALOG_GAP), so absolute NDCG is not measurable.
Decision prioritizes: multilingual support, operational simplicity (one API key),
storage cost at ≤1k courses, and swap-ability via `EmbeddingProvider`.

## Decision

**Ship default: Candidate A — `nvidia/nv-embedqa-e5-v5` (1024-d).**

```text
EMBEDDING_PROVIDER=nvidia
EMBEDDING_MODEL=nvidia/nv-embedqa-e5-v5
EMBEDDING_VERSION=v1
EMBEDDING_DIMENSION=1024
```

Override via env without code changes. Mixed `(model, version)` rows are never
queried together.

## Consequences

- `HttpEmbeddingProvider` talks OpenAI-compatible `/embeddings`
- `FakeEmbeddingProvider` used in unit tests (deterministic hash → unit vector)
- Changing model/version requires a new backfill wave and active-version cutover
- ANN indexes deferred until >20k courses or vector p95 > 250ms (plan §88.5)
