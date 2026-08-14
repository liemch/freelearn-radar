# Gate B — Intent Diagnosis Worksheet

Status: **OWNER OVERRIDE — M20.2+ authorized**

Previous status: PROVISIONAL PASS — CATALOG_GAP ≥ 50% (2026-08-14)

Prerequisite: Gate A PASS + M20.0 instrumentation shipped.

## Override (2026-08-14)

Owner explicitly authorized M20.2→M20.11 despite CATALOG_GAP ≥ 50%.

```text
Override rationale:
  • All new FEATURE_* flags default OFF — read path stays lexical
  • Embeddings / hybrid / NL / path code must not invent catalog coverage
  • STOP 1 / STOP 2 may be PROVISIONAL (NDCG N/A on thin catalog)
  • Coverage track continues in parallel
```

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

## Decision rule (§86.3) — superseded by owner override

```text
Default rule: CATALOG_GAP ≥ 50% → defer M20.2+
Owner override: authorize M20.2+ behind flags OFF
```

## Written conclusion

```text
Conclusion:           OWNER OVERRIDE — M20.2+ authorized
CATALOG_GAP share:    ≥ 50% of non-JUNK (unchanged finding)
Next allowed milestone: M20.2 Semantic Search Foundation
Rationale:
  Owner accepts that semantic retrieval cannot invent coverage.
  Implementation proceeds with FEATURE_SEMANTIC_SEARCH=false by default.
  Re-score this worksheet from production search_queries when N is meaningful.
```

## Coverage follow-up (parallel)

- Continue discovery throughput / free-by-policy providers
- Re-label Gate B from production `search_queries` when N is meaningful
- STOP 1 may remain provisional until labeled NDCG is measurable
