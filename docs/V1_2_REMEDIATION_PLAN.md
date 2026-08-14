# FreeLearn Radar v1.2 — Remediation Plan

Companion to `docs/V1_2_PRODUCTION_AUDIT.md`. Every finding referenced here is evidenced there.

> **This plan is not implemented.** It is a proposal awaiting approval. No code was changed while producing it.

## Principles applied

Recommendations prefer the smallest safe fix inside the existing architecture. No framework change, no new database, no new service, no queue. Where a finding could be fixed either by adding a guard or by removing an unused concept, both options are stated so the choice stays with the owner.

## Grouping

| Group | Meaning | Trigger |
|---|---|---|
| **R0** | Emergency — act today | Only if the live check below fails |
| **R1** | Must fix before M20.0 starts | Blocks v1.3 |
| **R2** | Must fix before any tracker/alert flag is enabled | Blocks the feature, not v1.3 |
| **R3** | Fix during early v1.3 | Operability and hygiene |
| **R4** | Backlog | Deferred scope, cleanup |

---

# R0 — Conditional Emergency

## R0.1 · Verify the two feature flags in production

**Do this before anything else.** Open Vercel → Project → Settings → Environment Variables and read the production values of `FEATURE_AUTO_STATUS` and `FEATURE_PRICE_ALERTS`.

**If both are unset or `"false"`:** no emergency. R0 is closed, proceed to R1. This is the expected outcome — both default OFF in `src/lib/env.ts`.

**If either is `"true"`:** set it to `"false"` and redeploy before doing anything else, then treat the following as P0 rather than P1.

| Flag | What is happening if it is on |
|---|---|
| `FEATURE_AUTO_STATUS` | The worker is rewriting `courses.priceType` and `certificateType` from events confirmed without the 2-hour spacing check (EVT-01) and without a working region guard (EVT-02), leaving no audit record (MON-01). Published pricing can be silently wrong with no way to reconstruct the prior value. |
| `FEATURE_PRICE_ALERTS` | Those same unvalidated events can dispatch subscriber email. §69.3 exists because one wrong alert loses a subscriber permanently. |

**Effort:** 5 minutes to check. **Owner:** whoever holds Vercel access.

## R0.2 · Confirm migration `0005` applied

Read-only query against production:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('course_observations','course_price_events',
                     'course_watches','admin_audit_log',
                     'provider_policies','topic_tags','api_usage_log');
```

Seven rows expected. Fewer means `db:migrate:run` did not complete during `vercel-build` and part of M19 is writing to tables that do not exist. **Effort:** 5 minutes.

---

# R1 — Before M20.0 (blocks v1.3)

These four share one rationale: v1.3 Smart Discovery will read, index, and embed the truth layer. Wrong labels become wrong embeddings, and a search index is far more expensive to correct than a query predicate.

## R1.1 · Close the three `FREE_TRIAL` leak paths — `TRU-01`

**Route 1 — user-supplied `?price=`.** The guard in `course-repository.ts:130-131` sits in an `else if`, so an explicit filter disables it. Change the free-list exclusion from a fallback into an invariant that applies regardless of the explicit filter, on surfaces labelled free. The cleanest expression is a per-surface flag, since `/explore` legitimately shows everything while `/free-courses/*` must not.

**Route 2 — `/best/[year]/[month]`.** `listPublishedCoursesWithProvider` filters only on `status`. Either add the price predicate to that repository function, or have the page call the guarded catalog query. Prefer the latter — one guard is easier to keep correct than two.

**Route 3 — `/topic/[slug]`.** Same shape; add the predicate to `listPublishedCoursesForTopicTag`.

**Also update the test that locks in the bug.** `src/db/repositories/catalog-sql.test.ts:96` asserts the exclusion is dropped when `priceType` is explicit. That assertion must be inverted for free-labelled surfaces, and a new test should cover `?price=FREE_TRIAL` against `/free-courses/*`, `/best/*`, and `/topic/*`.

`isEligibleForFreeLists` in `src/domain/course/free-durability.ts` already encodes the rule; reuse it rather than writing a fourth copy of the predicate.

**Effort:** ~half a day including tests. **Risk:** low — additive predicates.

## R1.2 · Read `provider_policies` from the database — `TRU-02`, `TRU-03`

`resolveCertificateWithPolicy` defaults to the hardcoded `SEED_PROVIDER_POLICIES` constant and no caller passes DB rows, so the table, its `effective_from`, and the admin policy UI are all inert.

Load active policies for the relevant provider at the call site and pass them in; keep the constant as the seed source only. Evaluate `effective_from` and `active` during resolution — both columns already exist. Cache per request if the extra query matters; at current volume it will not.

While in this code, add the two missing rules the spec's most common case needs: `coursera + FREE_AUDIT → PAID_CERTIFICATE` and `edx + FREE_AUDIT → PAID_CERTIFICATE`. That also closes most of `TRU-03` at the source.

For the remainder of `TRU-03`, add an enforcement point so `FREE_AUDIT` with `UNKNOWN` certificate cannot be written — `assertPriceTypeAllowed` is the natural home, since it already guards the same boundaries.

**Effort:** ~1 day. **Depends on:** nothing. **Risk:** medium — changes classification output. Run the existing `provider-policy.test.ts` suite and add a case asserting DB rows override the constant.

## R1.3 · Audit worker and pipeline state changes — `MON-01`, `AUD-01`

Five unaudited monitor writes are listed in the audit report, plus `createCandidate`, the candidate fetch/analyze transitions, discovery query success/failure, topic-tag sync, verification-driven `updateCourse`, and admin login.

Two options:

*Option A — call `writeAuditLog` at each site.* Explicit, easy to review, but each future write path must remember.

*Option B — wrap at the repository boundary,* so `updateCourse` and `insertPriceEvent` audit by construction. More work now; future callers inherit it. **Recommended**, because v1.3 adds more automated writes and this is precisely the case that recurs.

Either way: use `actorType: "WORKER"` for monitor and cron paths and `"AI"` where the AI provider determined the value — that enum member is currently never written. Populate `before_json` so the §79.3 undo mechanism becomes possible later. Keep payloads bounded; do not store fetched HTML.

Add the missing test: an audit-coverage test that asserts each state-changing route produces a row.

**Effort:** ~1–2 days for Option B. **Risk:** low — additive writes.

---

# R2 — Before enabling tracker or alerts

None of these blocks v1.3. All of them block turning on `FEATURE_TRACKER_UI`, `FEATURE_PRICE_ALERTS`, or `FEATURE_AUTO_STATUS`. Execute in order — later items depend on earlier ones.

## R2.1 · Complete the event confirmation rules — `EVT-01`

Add `extractionMethod` and `confidence` to the `ObservationState` type in `detect-events.ts:21-28`; both are already stored on the observation row and merely not carried through. Then add two predicates to `confirmTransitionsFromObservations`:

- pairwise `observedAt` delta ≥ 2 hours between the observations being compared;
- both observations deterministic, or one deterministic plus one AI at confidence ≥ 0.8.

Pure-function change to already-tested code. Add tests for observations minutes apart and for a low-confidence AI pair.

**Effort:** ~half a day.

## R2.2 · Make the region guard real — `EVT-02`

Two changes, both required; either alone is insufficient.

*Populate the region.* `run-monitor-batch.ts:163` calls `observeCourse(db, course, { now })` with no region. Pass one — an env-configured worker region is enough to start, since Vercel egress region is knowable. Add the variable to the env schema at the same time.

*Reject nulls.* `sameRegion` currently returns `a === b`, so `null === null` passes. Make it return false when either side is null.

Doing only the first leaves legacy null rows comparable. Doing only the second stops all event detection until regions are populated. Add the missing test: two null-region observations must not confirm.

Also implement §69.3's related rule — undetermined region must not produce `PRICE_CHANGED`.

**Effort:** ~half a day. **Depends on:** R2.1 (same function).

## R2.3 · Guard auto-status writes — `TRU-04`, `EVT-04`

`detect-events.ts:290-299` writes `transition.toState.priceType` directly, bypassing `assertPriceTypeAllowed`, so a coupon-worded page can set `FREE_WITH_COUPON` — a value §65.4 reserves for manual entry. Route the auto-status write through the same guard used by verification and approval.

Separately, `CERT_CHANGED` auto-updates `certificateType`, which is outside the transitions §69.3 permits. Either restrict auto-status to DELISTED, WENT_PAID, and WENT_FREE, or build the admin event-review queue the spec assumes exists. Restricting is the smaller fix and can ship now.

**Effort:** ~half a day. **Depends on:** R1.2 (shared guard).

## R2.4 · Make event creation idempotent at the database — `DAT-01`

Application-level deduplication uses SELECT-then-INSERT with no transaction, lock, or unique constraint, so concurrent runs can both pass the cooldown check.

*Option A — partial unique index* on `(course_id, event_type, date_trunc('day', confirmed_at))`. Declarative, survives future callers that forget to lock. Needs a decision on the exact identity window and a plan for the insert conflict.

*Option B — transaction with `SELECT FOR UPDATE`* on the course row around detection and insertion. No migration, but every future caller must remember.

**Recommended: A**, for the same reason as R1.3 Option B — the guarantee should not depend on caller discipline.

**Effort:** ~half a day plus a migration. **Risk:** low if the index is added `CONCURRENTLY` on a table this small.

## R2.5 · Resolve `isPublic` — `TRK-01`

The tracker filters `isPublic = true`; nothing ever sets it. Decide which the concept is meant to be:

*Option A — implement publication.* An admin action, or an automatic rule such as "public once confirmed and the course is PUBLISHED". Fits the spec's intent that events be reviewed before exposure.

*Option B — remove the column* and gate the public query on `confirmedAt IS NOT NULL` plus course status.

Either is defensible; leaving it as is guarantees an empty page. Whichever is chosen, add a test asserting the tracker returns rows for a confirmed event.

**Effort:** ~half a day (B) to ~1 day (A).

## R2.6 · Harden the public watch surface — `SEC-01`, `SEC-02`, `SEC-03`

Three small, independent fixes on `POST /api/watches`:

- Apply `checkRateLimit`, reusing the helper already used by admin login. Rate-limit by IP and by email.
- Store `confirm_token` and `unsubscribe_token` hashed rather than plaintext, and give the confirm token a TTL. Entropy is already strong; this limits blast radius if the database is read.
- Return a constant response regardless of prior subscription state, so the endpoint stops disclosing whether an email already watches a course.

Add the missing indexes on both token columns while touching this area (`DAT-03`) — every confirm and unsubscribe is currently a sequential scan.

**Effort:** ~1 day including a small migration.

## R2.7 · Run the STOP 3 replay — `EVT-05`

§73 requires 30 days of real data replayed with zero false events before the tracker is exposed. **Do this last in R2**, after R2.1 through R2.4 — replaying today would measure an engine with two guards missing and produce a misleading pass.

Build replay tooling that reads historical `course_observations` and runs `detectPriceEvents` against them without writing. `scripts/monitor-once.ts` is a live single batch, not a replay, and is not a substitute. Record the result in the repository so the gate is evidenced rather than asserted.

**Effort:** ~1–2 days. **Depends on:** R2.1, R2.2, R2.3, R2.4.

---

# R3 — Early v1.3

Operability work. None blocks a milestone; all of it makes the system diagnosable.

**Worker controls (`MON-02`).** Add per-domain rate limiting with `MONITOR_PER_DOMAIN_RPM`; add conditional requests using the `etag` column that already exists but is always null — §76 assumes roughly 60% bandwidth saving that is currently not realised; add a backoff ladder for `BLOCKED`; add a kill switch; move the hardcoded User-Agent in `safe-http-client.ts:79` into `MONITOR_USER_AGENT`, which §76 requires to carry a contact URL for ToS compliance.

**External call logging (`MON-03`).** Extend `api_usage_log` to Tavily, NVIDIA, Resend, candidate source fetch, and image fetch. Only the monitor writes it today, so no budget view can be built.

**Environment completeness.** Add the §74 variables missing from `src/lib/env.ts`: `MONITOR_PER_DOMAIN_RPM`, `MONITOR_USER_AGENT`, `EMAIL_REPLY_TO`, `EMAIL_DAILY_BUDGET`, and `MONITOR_DATABASE_URL` if the split is ever revisited. Add upper bounds to `MONITOR_CONCURRENCY` and `MONITOR_DAILY_FETCH_BUDGET`, which are currently unbounded positives. Document the whole M19 set in `.env.example` and `docs/PRODUCTION.md`, both of which stop before M19.

**`DISCOVERY_QUERY_LIMIT`.** Spec §74 says 25; code, `.env.example`, `PRODUCTION.md`, and `vercel-setup.sh` all say 15. Align the four, or amend the spec — but pick one.

**Bootstrap drift (`DAT-02`).** `scripts/neon-bootstrap.sql` is missing the `0003` image columns and records applied-migration hashes only for `0000`–`0002`. Regenerate it from the migration chain rather than hand-patching, so it cannot drift again.

**Resend timeout (`SEC-06`).** Add an `AbortController` and `EMAIL_DAILY_BUDGET`. Every other external dependency is bounded; this one is not.

**Remaining index (`DAT-03`).** Add `created_at` to the `course_price_events` composite index, matching the tracker's `confirmedAt DESC` ordering.

---

# R4 — Backlog

Grouped by theme rather than sequenced.

**Coverage loop (`COV-01`).** Write `discovery_rejections` rows at the ingest rejection point, compute rolling 30-day `junk_rate`, and surface the >50% warning. Until this exists, §67.5's self-tuning query loop cannot run and the column shown in the admin UI is permanently null.

**Admin throughput.** Bulk-action UI for the existing endpoint; undo built on `before_json`; keyboard shortcuts j/k/a/r/e/u; dashboard work list beyond the current 3 of 7+ items.

**Public surfaces.** `/{locale}/course/[slug]/history`, `/{locale}/collections/just-went-free`, RSS `/feed/free-now.xml`, `/api/public/events`. Add `/tracker` to the sitemap and navigation once it renders content.

**Email compliance.** RFC 8058 `List-Unsubscribe` and `List-Unsubscribe-Post` headers; bounce and complaint webhook. Both affect deliverability at Gmail and Outlook.

**Event types (`EVT-03`).** `DELISTED` needs `listRecentOkObservations` widened to see `NOT_FOUND` rows. `PRICE_CHANGED` needs `price_amount` and `currency` parsing, which is also currently absent.

**UX conformance.** Staleness thresholds to §70.3's <24h / 1–7d / >7d; the `BLOCKED` rule so a blocked course stops displaying a price; history empty-states; sparkline with a text equivalent.

**Data and history.** M19.3 backfill from `course_verifications`; observation cascade decision (`DAT-04`) — `RESTRICT` protects history but requires an archival path for course deletion, so this is a tradeoff to decide rather than an obvious fix.

**Provider onboarding.** Consolidate the nine provider-specific modules into a single descriptor, then onboard the six Group-A providers. The consolidation should come first — needing to edit nine files per provider is the most likely reason zero were onboarded.

**Spec conformance (P3).** `url-shape` to `assertAdmin`; `candidates/[id]` to allow EDITOR per §79.4, which also fixes EDITOR users seeing buttons that 403; remove or implement `FEATURE_PUBLIC_FEED`; delete the empty `domain/provider/index.ts` and the unused exports; move email copy into the dictionaries; localize the two hardcoded English metadata strings.

---

# Dependency graph

```
R0.1 verify flags ──► determines whether the plan below is sufficient
                      (if a flag is ON: fix R1.3 + R2.1 + R2.2 first)

R1.1 FREE_TRIAL ─────────────┐
R1.2 DB policies ──► R2.3    ├──► v1.3 / M20.0 may start
R1.3 worker audit ───────────┘

R2.1 confirmation ──┐
R2.2 region ────────┼──► R2.7 replay ──► tracker / alerts may be enabled
R2.3 auto-status ───┤
R2.4 idempotency ───┘
R2.5 isPublic ──────────────► tracker shows content
R2.6 watch hardening ───────► alerts may accept public traffic
```

R1 and R2 are independent and can run in parallel by different people. Within R2, items 1–4 must precede 7.

---

# Effort summary

| Group | Items | Rough effort | Gate it unblocks |
|---|---|---|---|
| R0 | 2 | 10 minutes | Confirms severity model |
| R1 | 3 | ~3 days | M20.0 / v1.3 start |
| R2 | 7 | ~5 days | Tracker and alert flags |
| R3 | 7 | ~4 days | Operability |
| R4 | ~25 | not estimated | Deferred scope |

Estimates assume one engineer familiar with the codebase and exclude review and deployment.

---

*This plan is a proposal. Nothing in it has been implemented. Await explicit approval before starting remediation.*
