# M16 Implementation Plan — Course Intelligence & Data Quality

Date: 2026-08-13  
Status: Implementing

## Existing capabilities (reuse, do not duplicate)

| Area | Existing | M16 action |
|------|----------|------------|
| `course_verifications` table | Schema only | Activate with repository + service |
| `lastVerifiedAt` | Set on approve/publish | Update on each successful verification |
| URL normalize + exact dedup | `normalizeUrl`, `detectDuplicate` | Keep; add **soft** title+provider suggest-only |
| Ranking freshness | Uses `publishedAt` | Prefer `lastVerifiedAt`, add trust penalty |
| Price/certificate enums | Complete | Deterministic classifiers from evidence text |
| Discovery budgets | `DISCOVERY_*`, `AI_ANALYSIS_LIMIT` | Add `MAX_VERIFICATIONS_PER_RUN` |
| AI Zod + prompt wrap | Exists | Add confidence routing + pre-filter before AI |
| Cron discover | Exists | Add `/api/cron/verify` |
| Course status FSM | DRAFT/PUBLISHED/EXPIRED/UNAVAILABLE | Drive EXPIRED/UNAVAILABLE from verification |

## Design principles

1. **Deterministic first** — free status / trust / priority never come from LLM alone.
2. **UNKNOWN over hallucination** — ambiguous phrases stay UNKNOWN / weaker types.
3. **Evidence trails** — every classification stores evidence JSON.
4. **History preserved** — append verification rows; never overwrite history.
5. **Conservative merge** — soft duplicates never auto-merge.
6. **Budget hard caps** — no unbounded verification/AI loops.

## Module map

```
src/domain/verification/
  evidence.ts
  free-status.ts
  certificate-status.ts
  trust.ts
  freshness-policy.ts
  priority.ts
  change-detection.ts
  expiration.ts
  verification-service.ts
  verify-batch.ts

src/domain/quality/
  metadata-completeness.ts
  confidence.ts
  candidate-prefilter.ts
  title-similarity.ts

src/db/repositories/verification-repository.ts
src/app/api/cron/verify/route.ts
```

## Schema changes (minimal)

Extend `course_verifications`:

- `evidence_json` jsonb — array of evidence records
- `notes` text — human/system summary
- `change_summary` text — e.g. `FREE_FULL→PAID`

Index: `(course_id, verified_at desc)`

No new tables. Trust score computed, not stored.

## Trust model (computed)

Signals → `trust_score` (0–100, coarse) → state:

- `VERIFIED` — recent successful verify + clear free/paid evidence
- `LIKELY_VALID` — recent enough, partial evidence
- `NEEDS_REVIEW` — low confidence / conflicting signals
- `STALE` — past freshness window
- `UNVERIFIED` — never verified

LLM does **not** set trust state.

## Verification flow

```
Course → select by priority → gather evidence (injected/mockable)
→ classify free/certificate deterministically
→ optional AI assist (interpret only; cannot override strong evidence)
→ detect changes → persist verification row
→ update course (price/cert/status/lastVerifiedAt) when rules allow
```

## Freshness & priority

Central policy in `freshness-policy.ts` (days until due by `priceType` + provider profile).

Priority: `CRITICAL | HIGH | NORMAL | LOW` from age overdue + coupon/temp free + failures + unknowns + popularity.

## Public / Admin UX

- Public: last verified, stale warning (accurate language, no “guaranteed free”)
- Admin candidate: source, free/cert, confidence band, evidence summary
- Admin course: latest verification + trust state (lightweight)

## Tests

Unit matrix for classifiers, trust, priority, expiration, dedup soft-match, ranking penalty, confidence routing, adversarial phrases, multi-day simulation fixture.

## Out of scope

Live Tavily/NVIDIA calls, redesign UI, Kafka, distributed cache, auto-merge duplicates.
