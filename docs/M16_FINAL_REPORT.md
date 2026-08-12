# M16 Final Report — Course Intelligence & Data Quality

Date: 2026-08-13  
Git: **not committed / not pushed**

## Final recommendation

**READY_FOR_LIVE_DATA_VALIDATION**

---

## 1. Existing functionality reused

- `course_verifications` schema + enums
- `lastVerifiedAt` on courses
- URL normalize + exact canonical dedup
- Ranking weights / free-value scoring
- Discovery batch + AI analyze pipeline
- Cron auth pattern, env Zod budgets
- Course status FSM (`EXPIRED` / `UNAVAILABLE`)
- M15 outbound URL safety + approve gates

## 2. New functionality implemented

- Deterministic free/certificate classifiers
- Evidence model + verification result engine
- Trust model (computed states)
- Freshness policy + recheck priority
- Expiration decisions + change detection
- Verification batch + `/api/cron/verify`
- Metadata completeness
- Discovery prefilter + soft duplicate hints
- AI confidence routing + analysis reuse hash
- Public stale/expired UX + admin classification “why”
- Multi-day simulation tests

## 3. Schema changes

Migration `drizzle/0002_verification_evidence.sql`:

- `evidence_json` jsonb
- `notes` text
- `change_summary` text
- index `(course_id, verified_at)`

No new tables.

## 4. Verification architecture

See `docs/COURSE_VERIFICATION_ENGINE.md`.

Flow: priority select → evidence → classify → persist history → update course.

## 5. Trust model

Signals → coarse `trust_score` → `VERIFIED | LIKELY_VALID | NEEDS_REVIEW | STALE | UNVERIFIED`.  
LLM does not set trust state.

## 6. Freshness strategy

Interval by `priceType` × provider profile (central policy).  
Public warning when older than 1.5× interval.

## 7. Expiration strategy

- Confident FREE→PAID → `EXPIRED` (page kept, noindex)
- Unavailable evidence → `UNAVAILABLE`
- Related courses shown as alternatives (existing related query only)

## 8. Deduplication improvements

- Exact URL normalize unchanged (utm stripped)
- Soft title+provider suggestion only; never auto-merge
- Rejects “Basics” vs “Basics Advanced” merges

## 9. Discovery improvements

- Prefilter rejects blog/news/login/pricing/search/category pages
- Allows learning paths/specializations
- Invalid outcomes counted without AI spend

## 10. AI cost protections

- Prefilter before AI
- Content-hash reuse within 72h
- `AI_ANALYSIS_LIMIT` + `MAX_VERIFICATIONS_PER_RUN`
- Confidence &lt; 0.55 → `ANALYZED` (extra review), not silent truth

## 11. Tests added

- Free/certificate matrix + adversarial phrases
- Trust / freshness / priority / expiration / changes
- Prefilter / soft dedup / confidence / metadata
- Ranking trust penalty
- Multi-day simulation (A/B/C over day 1/5/10/20)
- Low-confidence analyze routing

## 12. Bugs discovered/fixed

- Coupon+expired text incorrectly stayed `FREE_WITH_COUPON` → now `PAID`
- Unavailable transition incorrectly required high pricing confidence
- Ranking freshness ignored `lastVerifiedAt` (M15 debt) → fixed
- `course_verifications` unused → activated

## 13. Performance implications

- Verify cron caps at `MAX_VERIFICATIONS_PER_RUN` (default 25)
- Priority selection scans up to 200 published courses in-memory (acceptable MVP)
- Extra JSON evidence writes are append-only, indexed by course

## 14. Remaining technical debt

- No direct HTML page fetch adapter yet (uses Search snippets when Tavily configured)
- Soft duplicate suggestions not yet surfaced as a dedicated admin queue UI
- Trust score not persisted (computed on read — intentional)
- Catalog SQL `recommended` sort still quality-only (home uses full ranker)

## 15. Pending live verification

- Run migration `0002` on Neon
- Configure Tavily + run `/api/cron/verify` once
- Spot-check free status vs real provider pages
- Confirm evidence rows appear after approve + recheck

---

## Quality gates

| Gate | Result |
|------|--------|
| lint | **PASS** |
| typecheck | **PASS** |
| test | **PASS** (117) |
| build | **PASS** |

| Tests | Count |
|-------|-------|
| before M16 | 75 |
| after M16 | **117** |

## Deliverables

- `docs/M16_IMPLEMENTATION_PLAN.md`
- `docs/COURSE_VERIFICATION_ENGINE.md`
- `docs/M16_FINAL_REPORT.md`
- brief M16 note in `project-plan.md`

**STOP.** No commit, no push, no deploy.
