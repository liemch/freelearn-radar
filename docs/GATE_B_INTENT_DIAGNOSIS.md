# Gate B — Intent Diagnosis Worksheet

Status: **AWAITING HUMAN LABELING**

Prerequisite: Gate A PASS + M20.0 instrumentation shipped.

Do **not** start M20.1 until this document has a written CATALOG_GAP conclusion
(Cursor rule 41 / plan §86.3).

## Goal

Classify zero-result and low-CTR queries (prefer ≥150 frequency-weighted samples
from ~90 days) into:

| Label | Meaning | Implication |
|-------|---------|-------------|
| `RETRIEVAL_MISS` | Matching course exists in catalog; search failed | Semantic/hybrid may help |
| `CATALOG_GAP` | No catalog course satisfies the query | Coverage problem — embeddings will not fix |
| `CONSTRAINT_GAP` | Topic match exists but filters/metadata fail | Metadata / constraint UX |
| `JUNK` | Bot / test / non-intent | Ignore for product gates |

## How to sample

```bash
npm run search:intent-sample -- --days=90 --limit=150
```

Output: `data/search-eval/v1/intent-sample.json` (labels start as `null`).

Two people review independently against the live catalog; resolve disagreements
by discussion; record inter-annotator agreement below.

If production has too few `search_queries` rows yet, label the eval stubs in
`data/search-eval/v1/queries.json` plus any observed homepage/search failures,
and note the sample is **provisional**.

## Counts (fill after labeling)

```text
Sample size N                 =
RETRIEVAL_MISS                =
CATALOG_GAP                   =
CONSTRAINT_GAP                =
JUNK                          =
CATALOG_GAP share of non-JUNK =
Inter-annotator agreement     =
Labeled by                    =
Date                          =
```

## Decision rule (§86.3)

```text
CATALOG_GAP ≥ 50% of non-JUNK
  → defer M20.2+; keep M20.0 + optional cheap M20.1; fund coverage

CATALOG_GAP 25–50%
  → continue v1.3 with parallel coverage; consider dropping M20.8

CATALOG_GAP < 25%
  → full v1.3 relevance scope allowed after M20.1 gate
```

## Written conclusion (required before M20.1)

```text
Conclusion:           [pending]
CATALOG_GAP share:    [pending]
Next allowed milestone: [pending — do not assume M20.1]
Rationale:
  …
```

Early production context (Gate A §80.2): catalog ≈ 1 published free course.
Treat coverage risk as the default hypothesis until data says otherwise.
