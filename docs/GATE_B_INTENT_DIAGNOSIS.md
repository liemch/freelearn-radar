# Gate B — Intent Diagnosis Worksheet

Status: **PROVISIONAL PASS — CATALOG_GAP ≥ 50%**

Prerequisite: Gate A PASS + M20.0 instrumentation shipped.

Owner acceptance (2026-08-14): same pattern as Gate A §80.2 — provisional
conclusion on thin-catalog evidence, without waiting for ≥150 production
`search_queries` labels.

## Goal

Classify zero-result and low-CTR queries into `RETRIEVAL_MISS` / `CATALOG_GAP` /
`CONSTRAINT_GAP` / `JUNK` (plan §86.3).

## Sample basis (provisional)

```text
Production catalog size (Gate A smoke) ≈ 1 published free course
Production search_queries volume         insufficient for 150-query labeling
Eval stubs used as intent proxy          data/search-eval/v1/queries.json (62)
```

Against a ~1-course catalog, the large majority of realistic queries in the
eval set (KEYWORD / NL / CONSTRAINT / CROSS_LANG / NEGATIVE) cannot be
satisfied by any published course. That is **CATALOG_GAP**, not retrieval miss.

Exact-title stubs (e.g. CS50) may also be gaps until those titles exist.

## Counts (provisional)

```text
Sample size N                 = 62 eval stubs (proxy; not production logs)
RETRIEVAL_MISS                ≈ 0–few (catalog too thin to have hidden matches)
CATALOG_GAP                   = dominant share of non-JUNK
CONSTRAINT_GAP                = minority (filters only matter when topic exists)
JUNK                          = not scored in stub set
CATALOG_GAP share of non-JUNK ≥ 50% (operational finding)
Inter-annotator agreement     = N/A (owner provisional sign-off)
Labeled by                    = owner provisional (Gate A thin-catalog reading)
Date                          = 2026-08-14
```

Re-run with `npm run search:intent-sample` after traffic accumulates; if
CATALOG_GAP share falls below 50%, revisit M20.2+ deferral.

## Decision rule (§86.3)

```text
CATALOG_GAP ≥ 50% of non-JUNK
  → defer M20.2+; keep M20.0 + optional cheap M20.1; fund coverage
```

## Written conclusion

```text
Conclusion:           CATALOG_GAP ≥ 50% (provisional)
CATALOG_GAP share:    ≥ 50% of non-JUNK
Next allowed milestone: M20.1 Lexical Relevance Upgrade only
Rationale:
  Early production has ~1 verified free course. Embeddings cannot invent
  catalog coverage. Cheap lexical upgrades (unaccent / trgm / weighted rank)
  remain allowed; semantic/hybrid/NL/compare/path (M20.2+) stay deferred
  until coverage improves and this worksheet is re-scored on real logs.
```

## Coverage follow-up (out of M20.1 code scope)

- Raise discovery throughput / provider coverage (v1.2 §68 loop)
- Re-label Gate B from production `search_queries` when N is meaningful
- Only then reconsider M20.2+
