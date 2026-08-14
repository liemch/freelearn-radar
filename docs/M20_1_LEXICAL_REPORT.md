# M20.1 — Lexical Relevance Upgrade Report

Date: 2026-08-14

Status: **IMPLEMENTED — STOP BEFORE M20.2**

Gate B: provisional CATALOG_GAP ≥ 50%
([docs/GATE_B_INTENT_DIAGNOSIS.md](GATE_B_INTENT_DIAGNOSIS.md)).

## Shipped

- Migration `0008_m20_1_lexical.sql`: `unaccent`, `pg_trgm`,
  `immutable_unaccent()`, GIN trigram indexes on course/provider/category/topic
  text.
- Query prep: [`src/domain/search/lexical.ts`](../src/domain/search/lexical.ts)
  (diacritic fold, stopwords, provider aliases, LIKE escape).
- Catalog match + weighted rank:
  [`src/domain/search/lexical-sql.ts`](../src/domain/search/lexical-sql.ts)
  wired into
  [`src/db/repositories/course-repository.ts`](../src/db/repositories/course-repository.ts).
- Ranking config version: `lexical-v1` (logged on `search_queries`).

Weight order (plan §87): title > topic_tags > short_description > description
(+ provider boost + title trigram similarity).

## Gate checklist (§87.3)

| Check | Result |
|-------|--------|
| Extensions in migration for Neon | Yes (`CREATE EXTENSION IF NOT EXISTS`) |
| VI-không-dấu path | Folded query + `immutable_unaccent` on columns |
| Exact-title / NDCG vs EN | **Not measurable yet** — eval labels empty; catalog ~1 course |
| p95 vs baseline | Re-measure after migrate + traffic (`npm run search:baseline`) |
| Tests (unaccent, alias, weighted SQL) | Added |
| lint / typecheck / test / build | PASS (2026-08-14) |

## NDCG gap statement (required)

```text
Lexical upgrade NDCG gap closed vs target: unknown / not scored.
Reason: expectedLabels on data/search-eval/v1 are empty stubs; production
catalog too thin for meaningful graded relevance.
Proxy covered by unit/SQL fixtures: diacritic fold, alias expansion,
immutable_unaccent + similarity appear in catalog SQL, lexical rank precedes
quality_score when q is present.
```

When labels exist, re-run `npm run search:benchmark` and fill the % gap. If
lexical closes ≥ 70% of the target gap, revisit whether semantic (M20.2) can
stay deferred beyond coverage work.

## Explicit stop

**Do not start M20.2** (embeddings / semantic) until:

1. Coverage improves, and
2. Gate B is re-scored on real `search_queries` with CATALOG_GAP < 50%, or
3. Owner explicitly overrides the Gate B deferral in writing.
