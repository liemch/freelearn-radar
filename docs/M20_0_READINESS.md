# M20.0 Readiness

Status: **IMPLEMENTED — STOP FOR GATE B**

Survey date: 2026-08-14. Gate A marked PASS the same day (owner sign-off on
safety flags + provisional §80.2).

## Shipped in this milestone

1. Migration `0007_m20_foundation.sql` + Drizzle schemas:
   `search_queries`, `search_evaluations`, `search_benchmark_runs`
2. `recordSearchQuery` + normalizer/hash; public search page logs latency and
   result counts (stdout `trackProductEvent` kept)
3. `src/config/search-thresholds.ts` (provisional §85)
4. `npm run search:baseline` + `/admin/search` panel
5. Eval dataset `data/search-eval/v1/queries.json` (≥60 stubs) + Zod loader
6. Lexical benchmark stub: admin API + `npm run search:benchmark`
7. Gate B worksheet: `docs/GATE_B_INTENT_DIAGNOSIS.md` +
   `npm run search:intent-sample`

## Stop condition

**Do not open M20.1** until Intent Diagnosis has a written CATALOG_GAP
conclusion in `docs/GATE_B_INTENT_DIAGNOSIS.md`.

## Ops follow-up

- Run `npm run db:migrate:run` (or Vercel `vercel-build`) so `0007` applies.
- Generate traffic / wait for `search_queries` rows before trusting baseline %.
