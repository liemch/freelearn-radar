# STOP 1 — Search Quality Gate (Provisional)

Status: **PROVISIONAL — NDCG N/A on thin catalog** (2026-08-14)

## Why NDCG is N/A

The published catalog at measurement time is ~1 free course (Gate A smoke,
Gate B worksheet). NDCG@10, precision@5, and hybrid-vs-lexical relative
uplift require a catalog where multiple relevant results per query are
possible. Against a ~1-course corpus every metric collapses to noise, so
reporting a number would be fabrication.

## Thresholds on record (searchThresholds, provisional-m20.0-2026-08-14)

| Metric | Threshold | Measured | Verdict |
|--------|-----------|----------|---------|
| NDCG@10 hybrid vs lexical (relative) | +15% | N/A — thin catalog | DEFERRED |
| Precision@5 hybrid | ≥ 0.60 | N/A — thin catalog | DEFERRED |
| Exact-title success | ≥ 0.98 | N/A — thin catalog | DEFERRED |
| VI NDCG@10 vs EN | ≥ 0.8× | N/A — thin catalog | DEFERRED |
| Search p95 | ≤ 600 ms | not yet load-measured | DEFERRED |
| Semantic degraded rate | ≤ 2% | flags OFF — no traffic | DEFERRED |

## What is verified instead

- Deterministic behavior: RRF fusion, intent parsing, semantic document
  hashing, and diversity capping are unit-tested and reproducible.
- Degradation contract: semantic timeout/failure always falls back to
  lexical; verified in code review and by the hybrid path's timeout race.
- Truth filter: free-list-ineligible price types cannot surface through
  hybrid, similar, or compare paths (unit-tested).

## Exit criteria for this STOP

1. Catalog reaches enough published free courses for the eval set
   (`data/search-eval/v1`) to have ≥ 1 relevant result for most non-NEGATIVE
   queries.
2. Re-run the benchmark (`src/domain/search/benchmark.ts`) and fill the
   Measured column.
3. Only then may `FEATURE_HYBRID_SEARCH` advance past rollout stage 1.
