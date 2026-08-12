# Course Verification Engine

FreeLearn Radar M16 — data quality & trust.

## Lifecycle

```
Published course
  → recheck priority selection (budget-capped)
  → gather evidence (Search / Page metadata / Manual / optional AI assist)
  → deterministic free + certificate classification
  → change detection
  → append course_verifications row (history preserved)
  → update course fields + last_verified_at when rules allow
  → may transition PUBLISHED → EXPIRED / UNAVAILABLE
```

AI never auto-publishes and never overrides strong deterministic evidence.

## Trust model

Computed (not stored):

| Signal | Role |
|--------|------|
| verification freshness | Age of `last_verified_at` |
| metadata completeness | Required field coverage |
| source score | Evidence method quality |
| pricing confidence | Classifier confidence |
| certificate confidence | Classifier confidence |

States: `VERIFIED` | `LIKELY_VALID` | `NEEDS_REVIEW` | `STALE` | `UNVERIFIED`

Public UI does **not** expose raw scores.

## Evidence model

Each important observation stores:

- `type`, `sourceUrl`, `sourceProvider`, `observedValue`, `confidence`, `observedAt`, `method`

Methods: `SEARCH`, `PAGE_METADATA`, `PROVIDER_DATA`, `AI_EXTRACTION`, `MANUAL`  
(DB enum maps `PROVIDER_DATA`→`PAGE_METADATA`, `AI_EXTRACTION`→`AI`)

Answers: *Why do we believe this course is free?*

## Free status rules (conservative)

| Phrase | Result |
|--------|--------|
| Completely free / free full access | FREE_FULL |
| Free to audit / enroll for free | FREE_AUDIT |
| Coupon / promo code | FREE_WITH_COUPON |
| Limited time / $0 today | TEMPORARILY_FREE |
| Free trial | FREE_TRIAL |
| Free with subscription | PAID |
| Start learning for free / free preview | UNKNOWN |
| Certificate available (alone) | certificate UNKNOWN |

`UNKNOWN` preferred over hallucination.

## Freshness policy

Centralized in `freshness-policy.ts`:

- Coupon / temporary free → short interval
- Free audit → medium
- Stable providers (e.g. Microsoft Learn) → longer multiplier

## Recheck priority

`CRITICAL` | `HIGH` | `NORMAL` | `LOW` from overdue age, promotion type, failures, unknowns, popularity.

Cron: `GET /api/cron/verify` with `MAX_VERIFICATIONS_PER_RUN`.

## Expiration

- Free → Paid (confident) → `EXPIRED` (page kept, noindex)
- Unavailable evidence → `UNAVAILABLE`
- Historical rows never deleted

## Ranking relationship

Freshness uses `lastVerifiedAt` (fallback `publishedAt`).  
Trust state applies a deterministic multiplier — high AI score alone cannot dominate stale/unverified courses.

## AI role

1. Prefilter non-course URLs before AI
2. Confidence &lt; 0.55 → candidate status `ANALYZED` (extra review)
3. Reuse analysis when content hash unchanged
4. AI suggestions only fill gaps when text evidence is weak; capped confidence
