# M20.11 — Staged Rollout Plan

Status: **Stage 0 (all flags OFF)** (2026-08-14)

## Flags in scope

| Flag | Surface | Default |
|------|---------|---------|
| `FEATURE_SEMANTIC_SEARCH` | semantic retrieval path | OFF |
| `FEATURE_HYBRID_SEARCH` | lexical+semantic RRF on `/search` | OFF |
| `FEATURE_NL_COURSE_FINDER` | AI-assisted intent parse (stub) | OFF |
| `FEATURE_SIMILAR_COURSES` | diversity-capped similar section on course detail | OFF |
| `FEATURE_COURSE_COMPARE` | `/compare` facts table | OFF |
| `FEATURE_LEARNING_PATHS` | `/path` goal → steps | OFF |
| `FEATURE_CROSS_LANGUAGE` | VI↔EN retrieval | OFF |

Every flag is independent; any can be turned OFF instantly via env var
without a code change or redeploy dependency on the others.

## Stages

### Stage 0 — dark (current)

- All flags OFF. Lexical search is the only public retrieval path.
- Embedding cron may run to build coverage; it has no read-path effect.

### Stage 1 — internal validation

- Enable flags in a preview/staging deployment only.
- Checks: `/compare` and `/path` render and gate correctly, similar-courses
  cap holds (max 2/provider), no free-list-ineligible course on any surface,
  search p95 within 600 ms with semantic timeout at 400 ms.

### Stage 2 — production, low-risk surfaces first

- Order: `FEATURE_SIMILAR_COURSES` → `FEATURE_COURSE_COMPARE` →
  `FEATURE_LEARNING_PATHS`. These are read-only, deterministic, and cheap.
- Precondition: catalog large enough that the surfaces aren't visibly empty
  (similar section needs ≥ 3 publishable candidates for a typical course).
- Watch: `course_view` / product events, error logs, zero-result rates.

### Stage 3 — retrieval flags

- `FEATURE_SEMANTIC_SEARCH`, then `FEATURE_HYBRID_SEARCH`.
- Precondition: STOP 1 measured (not provisional) — see
  `STOP_1_SEARCH_QUALITY.md`; embedding coverage ≥ 95% of published courses.
- Watch: semantic degraded rate ≤ 2%, cache hit rate ≥ 60%, p95 ≤ 600 ms.

### Stage 4 — NL and cross-language

- `FEATURE_NL_COURSE_FINDER` (still deterministic-stub until a real AI parse
  ships with quota: 20/IP/hour, 2000/day) and `FEATURE_CROSS_LANGUAGE`.
- Precondition: Gate B re-labeled from production `search_queries`.

## Rollback

- Any regression: set the offending flag to empty/false and redeploy env
  (Vercel env change, no code rollback needed).
- NL quota counters are process-memory; a restart resets them and fails
  open to the deterministic parser — acceptable by design.

## Kill criteria

- Free-status truth violation on any surface: immediate flag OFF + incident
  note in `docs/`.
- Search p95 > 600 ms sustained after semantic enablement: turn off
  `FEATURE_HYBRID_SEARCH` first, then `FEATURE_SEMANTIC_SEARCH` if needed.
