# FreeLearn Radar v1.2 / M19 — Production Audit

Independent Principal Engineer review. **Audit only — no source code, tests, or migrations were modified.**

| Field | Value |
|---|---|
| Audit date | 2026-08-14 |
| Repository | `/run/media/hoang-liem/Data/Personal/freelearn-radar` |
| Commit audited | `8f2c0c8` (branch `main`, clean working tree) |
| Specification baseline | `project-plan-v1.2.md` (§65–§79) |
| Auditor mode | Read-only static analysis + local quality gates |

---

# Executive Summary

**Overall status: `READY_WITH_REMEDIATION` — conditional.**

The condition is a single live check. See [v1.3 Gate Decision](#v13-gate-decision).

v1.2 shipped a real, well-built **foundation**: the schema for coverage/truth/time exists and matches the ORM, the monitor cron runs on schedule, RBAC is enforced server-side on every admin route, the M18.4 SSRF architecture was correctly reused rather than re-implemented, and `course_observations` genuinely is append-only in application code.

What did not ship is the **operating product**. The audit found no admin auth bypass, no SSRF regression, no observation-history corruption, and no secret exposure — so there are **zero P0 findings under current configuration**. But roughly 40% of M19 is live; the rest is structurally present and dormant behind feature flags that default OFF.

Three themes dominate the findings:

1. **The anti-noise rules that justify the tracker are incomplete.** The event engine implements 2 of the 4 confirmation conditions in §69.3. It never checks the ≥2-hour spacing, and it never checks extraction method or confidence. Separately, `observed_region` is never populated at runtime, and because `sameRegion(null, null)` returns `true`, the region guard passes vacuously. These are exactly the defences the spec built to prevent the "one wrong alert loses a subscriber forever" failure.

2. **The truth invariant leaks in two places the spec calls absolute.** `FREE_TRIAL` is correctly excluded from the default catalog, but `/best/[year]/[month]` and `/topic/[slug]` bypass the catalog layer entirely and apply no price filter, and any free-list page accepts a user-supplied `?price=FREE_TRIAL`. The `provider_policies` table is seeded but never read — certificate resolution runs off a hardcoded in-memory constant, so `effective_from` is inert.

3. **The worker changes state with no audit trail.** `writeAuditLog` appears in 13 files, none under `src/domain/monitor/`. When `FEATURE_AUTO_STATUS` is enabled, the worker rewrites `courses.priceType` and `certificateType` and inserts events leaving no record of who changed what. §79.3 named this precise scenario as the reason M19.0 had to precede M19.7.

The mitigating fact that keeps every one of these out of P0 is that `FEATURE_AUTO_STATUS` and `FEATURE_PRICE_ALERTS` both default to OFF, and `isPublic` is never set to `true`, so no confirmed event ever reaches a user. The dangerous machinery is built but dormant.

**Counts:** P0 = 0 · P1 = 12 · P2 = 19 · P3 = 11 · Requires live verification = 7

---

# Audit Scope

**In scope.** M19.0 through M19.10 as defined in `project-plan-v1.2.md`; the Master Instruction additions §77 (#18–#37); amendments in §79.9 to earlier sections; M18.4 SSRF regression; database migrations `0000`–`0005`; environment schema; cron configuration; test quality.

**Out of scope.** Production runtime behaviour, live database contents, real provider BLOCKED rates, email deliverability, actual Vercel environment variable values, Lighthouse scores. These are recorded under [Production Verification Required](#production-verification-required).

**Method.** Specification read first and treated as authoritative. Repository treated as the only evidence of implementation. Claims from parallel analysis passes were independently re-verified against source before being recorded; one claim was downgraded on re-verification (see `SEC-04`). Where evidence was insufficient, findings are marked `NOT_VERIFIABLE` rather than guessed.

---

# Repository State

```
Branch:        main (clean, synced with origin/main)
HEAD:          8f2c0c8  expand discovery seed from 6 to 34 path-scoped queries
M19 commit:    ae99d73  Ship M19 core: truth, control, coverage, and time intelligence
Workspaces:    none (single package.json)
Migrations:    0000–0005, journal consistent with files on disk
Cron entries:  3 (discover 06:00, monitor 02:00, verify 18:00 UTC) — all daily
```

---

# Quality Gates

All four gates pass. Run individually, read-only.

| Gate | Command | Result | Notes |
|---|---|---|---|
| Lint | `npm run lint` | **PASS** | 0 errors, 2 pre-existing warnings |
| Typecheck | `npm run typecheck` | **PASS** | clean |
| Test | `npm run test` | **PASS** | 317 tests, 44 files |
| Build | `npm run build` | **PASS** | production build completes |

The two lint warnings are `no-page-custom-font` in `src/app/layout.tsx:31` and an unused destructured variable in `src/services/ai/nvidia-nim-provider.test.ts:75`. Neither is an M19 regression.

**Gates passing does not indicate M19 correctness.** Every finding in this report exists in a green build. The gate suite contains no test for: audit-log coverage, bulk actions, undo, stale expiry, event cooldown, concurrency, the 2-hour spacing rule, null-region handling, or the `FREE_TRIAL` leak paths — and one test actively asserts the leak behaviour is intended (`src/db/repositories/catalog-sql.test.ts:96`).

---

# Requirement Traceability Matrix

Status values: `PASS` · `PARTIAL` · `FAIL` · `NOT_IMPLEMENTED` · `NOT_VERIFIABLE`.
`PASS` requires evidence that behaviour is connected and executable, not merely that a file exists.

## M19.0 — Admin Foundation & Throughput

| # | Requirement | Spec | Implementation | DB | Tests | Wired | Status | Sev |
|---|---|---|---|---|---|---|---|---|
| 0.1 | `admin_audit_log` append-only | §79.3 | `src/domain/admin/audit-log.ts` | `0005` L71–87 | none | yes | PARTIAL | P1 |
| 0.2 | Audit on **every** state change incl. worker/cron/AI | §79.3, #33 | 13 call sites | — | none | partial | **FAIL** | P1 |
| 0.3 | RBAC server-side | §79.4, #34 | `src/lib/auth/rbac.ts` + per-route | — | `route-security.test.ts` | yes | PASS | — |
| 0.4 | ADMIN vs EDITOR split matches spec | §79.4 | see `SEC-04`, `SEC-05` | — | partial | PARTIAL | P3 |
| 0.5 | Bulk: 1 parent + N children, same `request_id` | §79.5 | `api/admin/candidates/bulk/route.ts` | — | none | **no UI** | PARTIAL | P2 |
| 0.6 | Undo from `before_json` | §79.3 | absent | — | none | no | **NOT_IMPLEMENTED** | P2 |
| 0.7 | Keyboard shortcuts j/k/a/r/e/u | §79.5 | absent | — | none | no | **NOT_IMPLEMENTED** | P2 |
| 0.8 | Saved views | §79.5 | `?view=` presets | — | none | yes | PARTIAL | P3 |
| 0.9 | Review priority ordering | §79.5 | `review-priority.ts` | — | yes | yes | PARTIAL | P2 |
| 0.10 | Auto-reject + view + undo + rule logged | §79.5 | `auto-reject.ts` | — | yes | yes | PARTIAL | P2 |
| 0.11 | Auto-approve forbidden | §79.5 | no path exists | — | — | yes | **PASS** | — |
| 0.12 | `EXPIRED_UNREVIEWED` after 30d | §79.5 | `expire-stale.ts` | enum `0005` | none | cron | PASS | — |
| 0.13 | `/admin/providers`, `/discovery/queries`, `/users` | §79.6 | all three exist | — | none | yes | PASS | — |
| 0.14 | Dashboard → clickable work list | §79.8 | 3 of 7+ items | — | none | yes | PARTIAL | P3 |

## M19.1 — Pricing & Certificate Truth

| # | Requirement | Spec | Implementation | Status | Sev |
|---|---|---|---|---|---|
| 1.1 | Only 100% off is free; partial → PAID | §66.4, #25 | `free-status.ts` — dollar/purchase signals only, no bare-percentage rule | PARTIAL | P2 |
| 1.2 | `FREE_TRIAL` never in any free list | §66.4, #25 | default catalog guarded; `/best/*`, `/topic/*`, and `?price=` unguarded | **FAIL** | P1 |
| 1.3 | `FREE_AUDIT` always carries certificate | §66.4 | no enforcement at any write boundary | **FAIL** | P1 |
| 1.4 | `FREE_WITH_COUPON` manual-only | §65.4, §66 | guarded on verify/approve; bypassed by auto-status | PARTIAL | P1 |
| 1.5 | Cert order MANUAL > policy > evidence > AI≥0.8 | §66.3, #24 | policy beats AI (tested); MANUAL not in resolver | PARTIAL | P2 |
| 1.6 | `provider_policies` deterministic | §66.2 | table seeded, **never read at runtime** | **FAIL** | P1 |
| 1.7 | `effective_from` honored | §66.2 | never read anywhere | **NOT_IMPLEMENTED** | P2 |
| 1.8 | `free_durability` derived | §66.5 | `free-durability.ts` | PASS | — |
| 1.9 | Backfill cert for UNKNOWN courses | M19.1 | no script or migration | **NOT_IMPLEMENTED** | P2 |
| 1.10 | Gate: 0 Udemy courses UNKNOWN after backfill | M19.1 | no backfill ⇒ ungated | **NOT_VERIFIABLE** | — |

## M19.2 — Provider Expansion & Taxonomy Depth

| # | Requirement | Spec | Implementation | Status | Sev |
|---|---|---|---|---|---|
| 2.1 | `CourseUrlClassifier` + shape registry | §67.5, #26b | `url-shape-classifier.ts` | PASS | — |
| 2.2 | UNKNOWN not over-blocked | §67.5, #26c | passes through | PASS | — |
| 2.3 | Classify at ingest, before fetch/AI | §67.5 | `candidate-service.ts:44–51` | PASS | — |
| 2.4 | `discovery_rejections` populated | §67.5 | table exists, **zero writes** | **NOT_IMPLEMENTED** | P1 |
| 2.5 | `junk_rate` computed + rolling 30d | §67.5 | column read/displayed, **never written** | **NOT_IMPLEMENTED** | P1 |
| 2.6 | junk_rate > 50% warns admin | §67.5 | absent | **NOT_IMPLEMENTED** | P2 |
| 2.7 | Path-scoped discovery queries | §55, #26d | 34 seeds, all path-scoped | PASS | — |
| 2.8 | Onboard 6 Group-A providers, 6 artifacts each | §67.6, §68 | 0 of 6 onboarded | **NOT_IMPLEMENTED** | P2 |
| 2.9 | Provider onboarding checklist doc | §67.6 | not found | **NOT_IMPLEMENTED** | P3 |
| 2.10 | `topic_tags` + `/topic/[slug]` | §67.3 | implemented, flag-gated | PASS | — |
| 2.11 | Topic noindex below 8 courses | §67.3 | `isTopicPageIndexable` | PASS | — |
| 2.12 | `zero_result` flag + admin view | §67.4 | not found | **NOT_IMPLEMENTED** | P2 |
| 2.13 | `DISCOVERY_QUERY_LIMIT` 15 → 25 | §74 | still 15 everywhere | **FAIL** | P2 |

## M19.3 / M19.4 / M19.5 — Observation, Monorepo, Worker

| # | Requirement | Spec | Implementation | Status | Sev |
|---|---|---|---|---|---|
| 3.1 | 3 new tables + ALTER courses | §69.2 | `0005`, ORM matches SQL | PASS | — |
| 3.2 | Observations append-only | #20 | no UPDATE/DELETE in app code | PASS | — |
| 3.3 | `observed_region` mandatory | §69.2 | nullable, **never populated** | **FAIL** | P1 |
| 3.4 | Backfill from `course_verifications` | M19.3 | absent | **NOT_IMPLEMENTED** | P2 |
| 3.5 | `observation_count` on courses | §69.2 | column absent from schema | **NOT_IMPLEMENTED** | P3 |
| 4.1 | pnpm workspace, apps/ + packages/ | M19.4 | no workspaces; in-repo cron | **NOT_IMPLEMENTED** | P2 |
| 5.1 | Reuse `CourseSourceFetcher`, no new fetcher | #18 | monitor → `fetchCourseSource` | PASS | — |
| 5.2 | `NO_FETCH` is law | #19 | enforced pre-network on all course paths | PASS | — |
| 5.3 | Per-domain rate limit | M19.5 | absent; env var absent | **NOT_IMPLEMENTED** | P2 |
| 5.4 | Conditional requests (ETag / IMS) | M19.5 | `etag` always null | **NOT_IMPLEMENTED** | P2 |
| 5.5 | Backoff on BLOCKED | §69.4 | fixed tier interval only | **NOT_IMPLEMENTED** | P2 |
| 5.6 | Kill switch | M19.5 | absent | **NOT_IMPLEMENTED** | P2 |
| 5.7 | Daily fetch budget + concurrency | M19.5 | `MONITOR_DAILY_FETCH_BUDGET`, `MONITOR_CONCURRENCY` | PASS | — |
| 5.8 | Adaptive tier | §69.4 | tier read, **never assigned/updated** | PARTIAL | P2 |
| 5.9 | `api_usage_log` on every external call | #31 | monitor only | **FAIL** | P2 |
| 5.10 | Monitor cannot publish/approve/create | #23 | verified — no such writes | PASS | — |
| 5.11 | Gate: 48h staging, 0 policy violation, ≥200 obs | M19.5 | no evidence | **NOT_VERIFIABLE** | — |

## M19.6 / M19.7 — Extraction & Event Detection

| # | Requirement | Spec | Implementation | Status | Sev |
|---|---|---|---|---|---|
| 6.1 | Order JSON_LD → OG → HTML_META → API → SEARCH → AI | M19.6 | first three only; AI/API/SEARCH absent from monitor | PARTIAL | P2 |
| 6.2 | AI only after deterministic fails | M19.6 | monitor calls no AI at all | PASS (vacuous) | — |
| 6.3 | Parse `price_amount`, `currency`, region | M19.6 | all three always null | **NOT_IMPLEMENTED** | P2 |
| 6.4 | External content is untrusted DATA | #39, §40 | regex path not injectable; AI path wraps + sanitizes | PASS | — |
| 6.5 | Provider HTML fixtures / snapshot tests | M19.6 | inline HTML only, no per-provider fixtures | **NOT_IMPLEMENTED** | P2 |
| 7.1 | ≥2 consecutive same-result observations | §69.3 | requires 3 | PASS | — |
| 7.2 | Spaced ≥2 hours apart | §69.3 | **no time-delta check anywhere** | **FAIL** | P1 |
| 7.3 | Same `observed_region` | §69.3, #22 | guard exists but vacuous (all null) | **FAIL** | P1 |
| 7.4 | Both deterministic, or 1 det + 1 AI ≥0.8 | §69.3 | `ObservationState` carries neither field | **FAIL** | P1 |
| 7.5 | DELISTED: ≥3 NOT_FOUND over ≥24h | §69.3 | enum only, never emitted | **NOT_IMPLEMENTED** | P2 |
| 7.6 | BLOCKED/TIMEOUT/ERROR never create events | #21 | triple-filtered to OK, tested | **PASS** | — |
| 7.7 | Unknown region → no PRICE_CHANGED | §69.3 | rule absent (`PRICE_CHANGED` never emitted) | PARTIAL | P2 |
| 7.8 | Cooldown 1/course/type/24h | §69.3 | query-based, no constraint | PARTIAL | P1 |
| 7.9 | Event idempotency under concurrency | §21 | SELECT-then-INSERT, no tx/lock/unique | **FAIL** | P1 |
| 7.10 | Auto-status limited to allowed transitions | §69.3 | adds `CERT_CHANGED`; omits DELISTED | PARTIAL | P2 |
| 7.11 | Publish/unpublish always human | §69.3, Rule 7 | no machine path exists | **PASS** | — |
| 7.12 | Gate: replay 30d real data, 0 false events | STOP 3 | no replay tooling, fixtures, or record | **NOT_VERIFIABLE** | P1 |

## M19.8 / M19.9 / M19.10 — UX, Tracker, Alerts

| # | Requirement | Spec | Implementation | Status | Sev |
|---|---|---|---|---|---|
| 8.1 | Card never exceeds 3 badges | §70.2, #29 | `MAX_COURSE_BADGES` + slice | **PASS** | — |
| 8.2 | Udemy FREE_FULL shows "No certificate" | §70.2 | conditional on stored value ≠ UNKNOWN | PARTIAL | P2 |
| 8.3 | Staleness thresholds <24h / 1–7d / >7d | §70.3 | day-granularity, different copy/thresholds | PARTIAL | P2 |
| 8.4 | NO_FETCH → "based on search signals" + hide chart | §70.3 | absent | **NOT_IMPLEMENTED** | P2 |
| 8.5 | BLOCKED → say nothing about price | §70.3 | UI shows stored `priceType` regardless | **FAIL** | P2 |
| 8.6 | UNKNOWN never rendered as certainty | §70.3 | correct on card and badges | PASS | — |
| 8.7 | History empty-state <3 / 3–10 / >10 | §70.4 | absent | **NOT_IMPLEMENTED** | P2 |
| 8.8 | Sparkline a11y text equivalent | §70.5 | no sparkline exists | **NOT_IMPLEMENTED** | P3 |
| 8.9 | VI no overflow at 380px | §70.5 | no test | **NOT_VERIFIABLE** | P3 |
| 9.1 | `/{locale}/tracker` | §71 | exists, flag-gated | PARTIAL | P1 |
| 9.2 | `/{locale}/course/[slug]/history` | §71 | **route does not exist** | **NOT_IMPLEMENTED** | P2 |
| 9.3 | `/{locale}/collections/just-went-free` | §71 | **route does not exist** | **NOT_IMPLEMENTED** | P2 |
| 9.4 | Tracker reflects observation history | §71 | queries `isPublic=true`, never set | **FAIL** | P1 |
| 9.5 | Sparkline + streak + typical price | M19.9 | absent | **NOT_IMPLEMENTED** | P2 |
| 9.6 | New routes bilingual | §71, #28 | tracker + topic have EN/VI | PASS | — |
| 9.7 | Tracker in sitemap | M19.9 | absent from `sitemap.ts` | **NOT_IMPLEMENTED** | P3 |
| 10.1 | `EmailProvider` + Resend impl | §72 | `email-provider.ts` | PASS | — |
| 10.2 | Only CONFIRM_WATCH + COURSE_WENT_FREE | §72, #30 | exactly two | PASS | — |
| 10.3 | Double opt-in | §72 | PENDING → CONFIRMED | PASS | — |
| 10.4 | No duplicate alert same course+email | §72 | unique index + NOTIFIED status | PASS | — |
| 10.5 | One failed email does not fail batch | §72 | per-watch try/catch | PASS | — |
| 10.6 | 1-click unsubscribe RFC 8058 | §72 | no `List-Unsubscribe` headers | **NOT_IMPLEMENTED** | P2 |
| 10.7 | Bounce/complaint webhook | §72 | absent | **NOT_IMPLEMENTED** | P2 |
| 10.8 | `EMAIL_DRY_RUN` | §72 | defaults `"true"` | PASS | — |
| 10.9 | RSS `/feed/free-now.xml` | §71 | **does not exist** | **NOT_IMPLEMENTED** | P2 |
| 10.10 | `/api/public/events` rate-limited, cached | §71 | **does not exist** | **NOT_IMPLEMENTED** | P2 |
| 10.11 | Feature flags default OFF | #32 | all OFF | PASS | — |

---

# M19.0 Findings — Admin & Control

RBAC is the strongest area of the release. All 13 admin API routes perform a server-side session check, and role checks are present rather than relying on hidden UI. `src/middleware.ts` gates `/api/admin/*` on session; individual handlers add the role check. The three cron routes verify `CRON_SECRET` and `verifyCronAuth` fails closed when the secret is unset (`src/lib/cron-auth.ts:5-7`), so there is no anonymous trigger path. No mass-assignment was found: every mutating route parses input through an explicit Zod schema.

Audit log coverage is the failure. The table and helper are correct and the schema carries all §79.3 fields, but coverage is selective rather than universal — see `AUD-01`. Undo and keyboard shortcuts were consciously deferred (`docs/M19_FINAL_REPORT.md:110-111`), which is defensible for throughput but means the M19.0 gate list is not met as written.

The bulk endpoint implements the parent/child `request_id` pattern correctly and caps at 50, but no component calls it, so operators cannot use it.

---

# M19.1 Findings — Truth Engine

The certificate resolver is correctly ordered where it matters most: provider policy returns before evidence and before AI, and two tests assert that Udemy `FREE_FULL` beats an AI `FREE_CERTIFICATE` suggestion at confidence 0.99. `assertPriceTypeAllowed` correctly blocks `FREE_WITH_COUPON` from non-manual sources on the verification and approval paths.

The weakness is that the authoritative layer is not the database. `resolveCertificateWithPolicy` defaults to the in-memory `SEED_PROVIDER_POLICIES` constant, so the `provider_policies` table — with its `effective_from`, `reviewed_at`, `active`, and `evidence_url` columns — is written by the seed and then never consulted. Editing a policy in the admin UI would not change resolution behaviour. Only 4 rules exist across 3 providers; Coursera and edX have no `FREE_AUDIT → PAID_CERTIFICATE` rule despite §66.4 naming that as the most common combination.

---

# M19.2 Findings — Coverage

The URL shape classifier is genuinely good: deterministic, runs at ingest before any fetch or AI spend, and correctly lets `UNKNOWN` shapes through rather than over-blocking (§67.5, #26c). Discovery queries are now path-scoped as §55 requires.

The measurement half of M19.2 is absent. `discovery_rejections` has a table and zero writes; `junk_rate` is displayed in the admin UI and used in an `ORDER BY` but is never computed, so it is permanently null. The self-tuning loop the spec describes — "query rác tự tố giác chính nó" — cannot function. Six Group-A providers were not onboarded.

---

# M19.3–M19.5 Findings — Observation & Worker

Append-only holds in application code: the only write path is `insertObservation`, and there is no `UPDATE` or `DELETE` against `course_observations` anywhere. The monitor reuses `fetchCourseSource` and therefore inherits the full M18.4 validation stack. `NO_FETCH` is checked before any network call on every course-fetch path.

`observed_region` is the critical gap and is covered in `EVT-02`. Beyond it, `etag`, `price_amount`, `currency`, and `enrollment_open` are always null, and the columns `volatility_score`, `free_streak_started_at`, `typical_price_amount` on `courses` are never written. Tracking tier is read but never assigned, so adaptive scheduling cannot adapt. The M19.3 backfill from `course_verifications` was not implemented, so historical charts would start empty.

M19.4 was not done. This appears deliberate — `docs/M19_FINAL_REPORT.md` records it as deferred and the in-repo cron approach fits the Hobby-tier deployment. It is recorded as a deviation, not a defect: no duplicate domain logic or circular dependency was found.

---

# M19.6–M19.7 Findings — Extraction & Events

Covered in detail under [Event Engine Findings](#event-engine-findings). The one unambiguous success is the failure guard: technical failures are filtered at three independent layers and are provably unable to become business truth. This is the single most important safety property in the milestone and it is correctly implemented and tested.

---

# M19.8–M19.10 Findings — UX, Tracker, Alerts

The 3-badge cap is enforced in code, not merely asserted by snapshot, and `UNKNOWN` values are correctly omitted rather than rendered as certainty. Watch tokens use `randomBytes(32)`, the unique index on `(course_id, email)` prevents duplicate subscriptions, and per-watch `try/catch` isolates email failures.

The tracker is dead on arrival for the reason in `TRK-01`. The staleness vocabulary predates the spec and uses day granularity and different thresholds. The `BLOCKED` rule is violated: the UI reads `courses.priceType` and knows nothing about the latest observation's fetch status, so a blocked course still displays a price. History empty-state rules, sparklines, `/history`, `/collections/just-went-free`, RSS, and `/api/public/events` do not exist.

---

# Security Findings

No P0 security issue was found. Specifically ruled out with evidence: admin auth bypass, anonymous cron trigger, SSRF regression on the course-fetch path, mass assignment, and secret leakage into logs or the audit table.

### SEC-01 · P2 · No rate limit on the public watch endpoint

`POST /api/watches` has no `checkRateLimit` call, unlike `POST /api/admin/auth/login`. An unauthenticated caller can create unbounded `PENDING` watch rows and trigger unbounded confirmation emails. Mitigated today by `FEATURE_PRICE_ALERTS` defaulting OFF (the route 404s) and `EMAIL_DRY_RUN` defaulting `"true"`. **Blocks v1.3: NO** — but must be fixed before alerts are enabled. Confidence: HIGH.

### SEC-02 · P2 · Watch tokens stored in plaintext with no expiry

`confirm_token` and `unsubscribe_token` are stored as plaintext in `course_watches` (`src/db/schema/course-watches.ts:23-24`) and never expire. Entropy is strong (256-bit), and the confirm token is cleared on use, which limits the exposure. A database read would nonetheless yield working unsubscribe links for every subscriber. Storing a hash and adding a confirm-token TTL is the smaller, conventional fix. **Blocks v1.3: NO.** Confidence: HIGH.

### SEC-03 · P2 · Subscription status disclosure

`POST /api/watches` returns `{ ok: true, status: watch.status }`, distinguishing `PENDING` from `CONFIRMED`. An attacker can therefore test whether a given email already watches a given course. Returning a constant response regardless of prior state is the standard remedy. **Blocks v1.3: NO.** Confidence: HIGH.

### SEC-04 · P3 · `/api/admin/url-shape` allows EDITOR

`src/app/api/admin/url-shape/route.ts:16` uses `assertEditor`, while §79.4 places the URL shape registry under ADMIN. **This was initially flagged as the top security finding and is downgraded here on re-verification:** the route is a read-only preview utility that classifies a submitted URL string and returns the result. It performs no database write and discloses only classifier rules that are already inferable from public site behaviour. The correct fix is a one-line change to `assertAdmin` for spec conformance, not a security remediation. **Blocks v1.3: NO.** Confidence: HIGH.

### SEC-05 · P3 · `/api/admin/candidates/[id]` requires ADMIN, contradicting spec

§79.4 grants EDITOR the right to approve, reject, edit, and re-analyze candidates. The route requires ADMIN (`requireAdmin`, lines 26–32), while the bulk route correctly allows EDITOR. The result is both an internal inconsistency and a broken EDITOR experience: the candidate UI renders action buttons that return 403. This errs toward restriction, so it is a functional defect rather than a vulnerability. **Blocks v1.3: NO.** Confidence: HIGH.

### SEC-06 · P2 · Resend calls have no timeout

`src/services/email/email-provider.ts:43` calls `fetch` with no `AbortController`, no retry, and no budget. A hung Resend connection would occupy the monitor cron until the 300 s `maxDuration` kills it. Every other external dependency in the codebase is bounded; this one is not. **Blocks v1.3: NO.** Confidence: HIGH.

---

# Data Integrity Findings

### DAT-01 · P1 · No database-level uniqueness on `course_price_events`

**Requirement.** §21 and §69.3 require that a given transition produce exactly one event, with a 24-hour cooldown per course per event type.

**Observed.** `drizzle/0005_m19_coverage_truth_time.sql:198-199` creates only two non-unique indexes. There is no unique constraint, no partial unique index, and no idempotency key. Deduplication is performed entirely in application code by `withinCooldown` (`detect-events.ts:218-228`) and a `fromState`/`toState` comparison (lines 266–275), both of which read `listRecentEventsForCourse` and then insert without a transaction, `SELECT FOR UPDATE`, or advisory lock.

**Impact.** Two concurrent invocations processing the same course can both pass the cooldown check before either commits, producing duplicate events. Because `notifyWatchesForEvents` sends one email per event, duplicate events become duplicate subscriber emails — the outcome §69.3 was written to prevent.

**Realistic likelihood today is low:** a single daily Vercel cron with `max: 1` connection pooling and no other caller of `detectPriceEvents`. The risk rises the moment a manual trigger, a retry, or a second worker is added.

**Remediation.** A partial unique index on `(course_id, event_type, date_trunc('day', confirmed_at))`, or wrap detection and insertion in a transaction with a row lock on the course. Prefer the index: it survives future callers that forget the lock.

**Blocks v1.3: NO** (dormant). Confidence: HIGH.

### DAT-02 · P2 · `neon-bootstrap.sql` has drifted from the migration chain

`scripts/neon-bootstrap.sql` is missing the `0003` image columns (`image_source_url`, `image_storage_url` verified absent) and records applied-migration hashes only for `0000`–`0002`, while appending the M19 block manually. A database created from this script would lack columns that runtime code reads. The primary path is `npm run vercel-build` → `db:migrate:run`, so this only bites when the fallback is used. **Blocks v1.3: NO.** Confidence: HIGH.

### DAT-03 · P2 · Missing indexes on hot lookups

`course_watches.confirm_token` and `unsubscribe_token` are queried directly (`watch-service.ts:106-110, 137-141`) with no index — every confirmation and unsubscribe is a sequential scan. `course_price_events` lacks `created_at` in its composite index while the tracker orders by `confirmedAt DESC`. Both are small tables today. **Blocks v1.3: NO.** Confidence: HIGH.

### DAT-04 · P3 · `ON DELETE CASCADE` on observations

`course_observations.course_id` cascades (`0005` L172-173). Deleting a course silently destroys its observation history, which sits uneasily with the append-only invariant #20. No application path deletes courses, so this is latent. The tradeoff is real: `RESTRICT` would block legitimate course deletion and require an archival path, which may not be worth building yet. Recorded for a decision, not an automatic fix. Confidence: HIGH.

### DAT-05 · P2 · ORM/SQL parity is clean

Recorded as a positive finding. Every M19 table, column, type, nullability, default, and index name in `src/db/schema/**` matches `0005`. The journal lists all six migrations consistently with the files on disk. `0005` uses `IF NOT EXISTS` and `duplicate_object` guards throughout, so it is idempotent and low-lock. Confidence: HIGH.

---

# Truth Engine Findings

### TRU-01 · P1 · `FREE_TRIAL` reaches free-labelled pages by three routes

**Requirement.** §66.4 and Master Instruction #25: `FREE_TRIAL` must never appear in any "free" list. No exceptions.

**Observed.** The default catalog guard is correct:

```130:131:src/db/repositories/course-repository.ts
    // Default free catalog: FREE_TRIAL / PAID never appear in free lists (§66.4).
    conditions.push(notInArray(courses.priceType, ["FREE_TRIAL", "PAID"]));
```

Three paths avoid it.

*Route 1 — user-supplied filter.* The guard sits in an `else if`, so any explicit `priceType` disables it. `parseCatalogFilters` accepts `?price=` from the query string and validates only membership in the `PriceType` enum, which includes `FREE_TRIAL`. `/vi/free-courses/ai?price=FREE_TRIAL` therefore renders a page titled as free listing only trial courses. A test asserts this is intended: `src/db/repositories/catalog-sql.test.ts:96` — "does not apply free-list exclusion when priceType is explicit".

*Route 2 — `/best/[year]/[month]`.* Uses `listPublishedCoursesWithProvider`, whose only predicate is `eq(courses.status, "PUBLISHED")` (`course-repository.ts:312`). No price filter reaches the "Best Free Online Courses" collection.

*Route 3 — `/topic/[slug]`.* `listPublishedCoursesForTopicTag` filters on `and(eq(courseTopicTags.tagId, tagId), eq(courses.status, "PUBLISHED"))` (`topic-tags.ts:195`). No price filter. Currently flag-gated OFF.

**Impact.** A user or search engine reaching any of these surfaces sees trial courses presented as free — the exact trust failure §66.4 exists to prevent. `/best/*` is indexable and unflagged, making it the live one.

**Why this matters for v1.3.** Smart Discovery and semantic search will index and embed the catalog. Wrong labels propagate into the index and become far more expensive to correct than a `WHERE` clause.

**Remediation.** Route the two bypass queries through the catalog guard, and treat `FREE_TRIAL` as non-selectable on free-labelled surfaces rather than merely absent from the filter UI. Reuse `isEligibleForFreeLists`, which already encodes the rule.

**Blocks v1.3: YES.** Confidence: HIGH.

### TRU-02 · P1 · `provider_policies` table is never read at runtime

`resolveCertificateWithPolicy` defaults its `policies` argument to the hardcoded `SEED_PROVIDER_POLICIES` constant (`provider-policy.ts:95-96`), and no caller passes DB rows. Consequences: the admin policy UI cannot influence classification; `effective_from` is never evaluated, so time-scoped policy is inert; `reviewed_at`/`reviewed_by` are decorative. §66.2 designed this table as the deterministic authority. **Blocks v1.3: YES** — v1.3 truth quality depends on it. Confidence: HIGH.

### TRU-03 · P1 · `FREE_AUDIT` with `UNKNOWN` certificate is reachable

§66.4 states `FREE_AUDIT` must always carry a certificate type, because audit-plus-paid-certificate is the most common real combination. No enforcement exists at any boundary: `approve-candidate.ts:183-186` falls back to `"UNKNOWN"`, the admin course form accepts any enum combination, and `produceVerificationResult` can retain a prior `UNKNOWN`. Compounding it, no `coursera + FREE_AUDIT` or `edx + FREE_AUDIT` policy rule exists to supply the value. **Blocks v1.3: YES.** Confidence: HIGH.

### TRU-04 · P1 · Auto-status can write `FREE_WITH_COUPON`, bypassing the MANUAL gate

`assertPriceTypeAllowed` guards verification and approval, but `detect-events.ts:290-299` writes `transition.toState.priceType` straight to `updateCourse` with no guard. `classifyFreeStatusFromText` can produce `FREE_WITH_COUPON` from coupon wording (`free-status.ts:119-137`), so with `FEATURE_AUTO_STATUS=true` an observation can set a value §65.4 restricts to manual entry. Dormant while the flag is OFF. **Blocks v1.3: NO** (fix before enabling the flag). Confidence: HIGH.

### TRU-05 · P2 · Partial-discount rule is incomplete

§66.4's "partial discount → PAID, no exceptions" is only enforced via dollar amounts and purchase verbs. Text such as `50% off` or `75% discount` with no `$` figure does not classify as PAID. No test covers a bare percentage discount. Confidence: HIGH.

---

# Monitor / Observation Findings

### MON-01 · P1 · Worker state changes produce no audit record

**Requirement.** Master Instruction #33: every state change writes `admin_audit_log`, including worker, cron, and AI. §79.3 justifies M19.0 preceding M19.7 precisely so that worker-driven `status` and `price_type` changes are attributable.

**Observed.** `writeAuditLog` is called from 13 files; none is under `src/domain/monitor/`. Unaudited state changes on the monitor path:

| Write | Location | Audited |
|---|---|---|
| `insertPriceEvent` | `detect-events.ts:277` | no |
| `updateCourse` — `priceType` | `detect-events.ts:297` | no |
| `updateCourse` — `certificateType` | `detect-events.ts:305` | no |
| `updateCourse` — schedule fields | `observe-course.ts:276` | no |
| `courseWatches` → NOTIFIED | `notify-watches.ts:118` | no |

Also unaudited elsewhere: `createCandidate`, candidate fetch/analyze transitions, `markDiscoveryQuerySuccess/Failure`, topic-tag sync, verification-driven `updateCourse` (`verify-batch.ts:185`), and admin login. `actorType: "AI"` is never written anywhere despite being in the enum.

**Impact.** If the tracker later reports a wrong price, there is no way to determine whether a worker, an editor, or the AI changed it, and no `before_json` from which to reconstruct the prior value. The undo mechanism §79.3 specifies is built on `before_json` and cannot function for these paths.

**Remediation.** Write `actorType: "WORKER"` audit rows in `detectPriceEvents` around the auto-status update and event insert, and in the candidate pipeline transitions. Prefer wrapping at the repository boundary so future callers inherit it.

**Blocks v1.3: YES** — v1.3 adds more automated writes on top of an already-untraceable base. Confidence: HIGH.

### MON-02 · P2 · Missing worker controls

No per-domain rate limit (`MONITOR_PER_DOMAIN_RPM` is absent from the env schema), no conditional requests (`etag` always null, so the ~60% bandwidth saving §76 assumes is not realised), no BLOCKED backoff ladder, and no kill switch. The User-Agent is hardcoded in `safe-http-client.ts:79` rather than read from `MONITOR_USER_AGENT`, which §76 requires to carry a contact URL for ToS compliance. Confidence: HIGH.

### MON-03 · P2 · `api_usage_log` covers only the monitor batch

Master Instruction #31 requires every external call to log usage with `worker_version`. Tavily, NVIDIA, Resend, candidate source fetch, and image fetch write nothing. Budget dashboards and the §79.7 ops view cannot be built on this. Confidence: HIGH.

---

# Event Engine Findings

### EVT-01 · P1 · Two of four confirmation conditions are missing

**Requirement.** §69.3 requires all of: ≥2 consecutive matching observations; spaced ≥2 hours apart; same `observed_region`; and both deterministic, or one deterministic plus one AI at confidence ≥0.8.

**Observed.** `confirmTransitionsFromObservations` (`detect-events.ts:54-119`) implements the count (in fact requiring 3, which is stricter) and a region comparison. It never compares `observedAt` between observations — there is no time-delta arithmetic in the file. And `ObservationState` (lines 21–28) carries only `id`, `priceType`, `certificateType`, `observedRegion`, `observedAt`, and `fetchStatus`: neither `extractionMethod` nor `confidence` is available to check, even though both are stored on the row.

**Impact.** Three observations taken minutes apart — a retry, a manual trigger, a CDN cache flap — satisfy confirmation. A price A/B test or a flash sale, the two scenarios §69.3 names, would confirm as a real transition. Low-confidence regex extraction is treated with the same authority as JSON-LD.

**Remediation.** Add `extractionMethod` and `confidence` to `ObservationState`, then add two predicates to the confirmation loop: a pairwise `observedAt` delta ≥ 2 h, and the deterministic/AI-confidence rule. Both are pure-function changes to already-tested code.

**Blocks v1.3: NO** (dormant — no event reaches a user). **Blocks enabling the tracker or alerts: YES.** Confidence: HIGH.

### EVT-02 · P1 · The region guard passes vacuously

**Requirement.** §69.2 marks `observed_region` mandatory; #22 forbids comparing prices across regions.

**Observed.** Four facts compound:

1. The column is nullable — `observedRegion: text("observed_region")` (`course-observations.ts:38`).
2. The writer defaults to null — `observedRegion: options.observedRegion ?? null` (`observe-course.ts:264`).
3. The only production caller passes no region — `observeCourse(db, course, { now })` (`run-monitor-batch.ts:163`).
4. The comparator treats null as a match — `sameRegion(a, b) { return a === b }` (`detect-events.ts:41-43`).

Every observation in production therefore has `observedRegion = null`, and every null-to-null comparison returns `true`. The guard cannot reject anything. Additionally, §69.3's rule "undetermined region → do not create `PRICE_CHANGED`" is not implemented.

**Why the passing test is misleading.** `detect-events.test.ts:92-98` constructs observations with explicit `"US"` and `"EU"` values and correctly asserts rejection. No test supplies null regions — the production case. The test suite validates a code path that production never takes.

**Remediation.** Two independent changes: populate the region at the point of observation (from an env-configured worker region, at minimum, since Vercel egress region is knowable), and make `sameRegion` reject when either side is null. Either alone is insufficient — the first without the second leaves legacy null rows comparable; the second without the first stops all event detection.

**Blocks v1.3: NO** (dormant). **Blocks enabling the tracker or alerts: YES.** Confidence: HIGH.

### EVT-03 · P2 · Three event types are declared but never emitted

`PRICE_CHANGED`, `DELISTED`, and `RETURNED` exist in the `PriceEventType` union and the database enum but no code path produces them. `DELISTED` is the notable loss: `NOT_FOUND` observations are recorded, but `listRecentOkObservations` filters to `OK` only, so a delisted course can never be detected, and the §69.3 auto-status transition to `UNAVAILABLE` is unreachable. Not dangerous — the system stays silent rather than wrong. Confidence: HIGH.

### EVT-04 · P2 · `CERT_CHANGED` auto-writes outside the allowed set

§69.3 permits auto-status for confirmed DELISTED, WENT_PAID, and WENT_FREE, and routes everything else to an admin queue. `detect-events.ts:302-309` also auto-updates `certificateType` on `CERT_CHANGED`. No admin event-review queue exists to route it to, which is the underlying reason. Confidence: HIGH.

### EVT-05 · P1 · STOP 3 replay cannot be evidenced

§73 STOP 3 requires replaying 30 days of real data with zero false events before any tracker UI is exposed. No replay script, fixture set, recorded result, or test exists. `scripts/monitor-once.ts` runs a single live batch, which is not a replay. `docs/M19_FINAL_REPORT.md:102` lists STOP 3 as still binding.

Marked **`NOT_VERIFIABLE`** rather than FAIL: the gate may have been consciously skipped because the UI was never exposed. Given EVT-01 and EVT-02, a replay run today would be measuring an engine with two guards missing, so the correct order is remediate first, then replay. **Blocks enabling the tracker: YES.** Confidence: HIGH.

---

# Alerts Findings

The alert core is sound: double opt-in, 256-bit tokens, a unique index preventing duplicate subscriptions per course and email, a `NOTIFIED` status preventing repeat sends, and per-watch exception isolation so one failure cannot abort a batch. `EMAIL_DRY_RUN` defaults to `"true"`.

Gaps beyond the security items already listed: no `List-Unsubscribe` / `List-Unsubscribe-Post` headers, so the RFC 8058 one-click requirement in §72 is unmet and deliverability at Gmail and Outlook will suffer; no bounce or complaint webhook, so `status` cannot reflect delivery reality; `EMAIL_DAILY_BUDGET` is absent from the env schema, leaving sends uncapped; and no end-to-end test covers watch → confirm → event → email → unsubscribe.

One design question rather than a defect: once a watch reaches `NOTIFIED`, a later `WENT_FREE` for the same course does not re-alert. That may be intended, but it is not stated in §72 and deserves an explicit decision.

---

# I18N / SEO Findings

Locale handling on new routes is correct. Tracker and topic pages use `LocalizedLink`, carry full EN/VI dictionary entries, and emit `hreflang` via `buildLocaleAlternates`. Topic pages correctly `noindex` below the 8-course threshold, reusing the M17 guardrail. No admin or operational URL appears in `sitemap.ts`.

Remaining gaps are minor and all P3: email subject and body copy is built inline in `watches/route.ts:42-49` and `notify-watches.ts:84-96` with an EN/VI branch rather than going through the dictionaries; two metadata descriptions are hardcoded English (`course/[slug]/page.tsx:67`, `collections/[slug]/page.tsx:62`); `/tracker` is absent from the sitemap and from navigation; and the §70.5 requirement to test Vietnamese layout at 380 px has no test, so it is `NOT_VERIFIABLE`.

---

# Runtime Wiring Findings

The central question of this audit is whether M19 operates or merely exists. The answer, layer by layer:

| Subsystem | Operating? | Determining evidence |
|---|---|---|
| Schema + migration `0005` | **YES** | applied by `vercel-build` |
| Monitor cron → observations | **YES** | scheduled, authenticated, writes rows |
| Event detection | **YES, partially** | 3 of 6 event types |
| Audit log writes | **YES, partially** | admin paths only |
| Audit log reads | **NO** | `listRecentAuditLogs` has no caller; no admin UI |
| Truth policy from DB | **NO** | hardcoded constant used instead (`TRU-02`) |
| Tracker public feed | **NO** | `isPublic` never true (`TRK-01`) |
| Price alerts | **NO** | flag OFF + dry-run |
| Topic pages | **NO** | flag OFF |
| Auto-status | **NO** | flag OFF |
| Public feed | **NO** | flag declared, never read; no route |
| junk_rate / rejection loop | **NO** | zero writes |
| Bulk actions | **NO** | API exists, no UI |

### TRK-01 · P1 · The tracker queries a flag that is never set

`listRecentPublic` filters `eq(coursePriceEvents.isPublic, true)` (`price-event-repository.ts:43`). Every insert hardcodes `isPublic: false` (`detect-events.ts:286`). A repository-wide search finds no code that ever sets it true. Therefore `/tracker` renders an empty list even with `FEATURE_TRACKER_UI=true` and events present in the table.

This is the clearest instance of structural completion without operation: the page, the query, the repository, the schema column, and the i18n strings all exist, and the feature cannot work. Either a publication step is missing, or `isPublic` should be dropped in favour of gating on `confirmedAt`.

**Blocks v1.3: NO.** **Blocks the tracker: YES.** Confidence: HIGH.

### WIR-01 · P3 · Dead code and unused exports

`src/domain/provider/index.ts` is an empty module. `listUnconfirmed`, `findWatchByConfirmToken`, and `listRecentAuditLogs` have no callers. `src/services/images/course-image-service.ts` is imported only by its test. `FEATURE_PUBLIC_FEED` is parsed and never read. The `SEARCH_RESULT_ONLY` fetch policy value is never assigned. `volatility_score`, `free_streak_started_at`, `typical_price_amount`, `junk_rate`, and `last_junk_review_at` are columns that no code writes. None is harmful; together they are the measurable signature of deferred scope. Confidence: HIGH.

---

# Test Quality Findings

317 passing tests is not the useful number. The useful number is how many of the M19 gate conditions have a test, and that number is low.

**Tests that assert real behaviour.** `provider-policy.test.ts` genuinely exercises the policy-beats-AI conflict with a high-confidence AI suggestion. `free-status.test.ts` includes a real prompt-injection string and asserts it does not classify as free. `catalog-sql.test.ts` inspects generated SQL rather than mocking the query builder. `url-shape-classifier.test.ts` covers positive and negative URL shapes. `detect-events.test.ts` tests the pure confirmation function directly, which is the right approach for that unit.

**False confidence.** Three patterns matter:

*Tests that validate an unreachable path.* The region test uses `"US"` and `"EU"`; production only ever produces null. The test passes and the guard is broken (`EVT-02`).

*A test that encodes a spec violation as intended behaviour.* `catalog-sql.test.ts:96` asserts the free-list exclusion is disabled when `priceType` is explicit. This locks in `TRU-01`.

*Repository-mocked tests asserting only that a call happened.* `approve-candidate.test.ts` mocks all repositories and checks `createCourse` was called, without asserting the resolved price type, certificate type, or that `FREE_WITH_COUPON` was blocked — the interesting logic in that function.

**Absent entirely.** No test for: audit-log coverage on any route, bulk parent/child `request_id`, undo, `expireStaleCandidates`, event cooldown, concurrent event insertion, the 2-hour spacing rule, null-region observations, DELISTED, auto-status scope, `FREE_TRIAL` on `/best/*` or `/topic/*`, watch-flow end-to-end, or Vietnamese layout overflow.

---

# Production Verification Required

Repository inspection cannot establish these. Ordered by urgency.

| # | Item | Why it matters | Method |
|---|---|---|---|
| 1 | **Actual values of `FEATURE_AUTO_STATUS` and `FEATURE_PRICE_ALERTS` in Vercel** | Determines whether this audit's severity model holds. If either is `"true"`, EVT-01/EVT-02/TRU-04/MON-01 become **P0 immediately**. | Vercel → Settings → Environment Variables |
| 2 | Whether migration `0005` actually applied | `vercel-build` runs `db:migrate:run`, but success is unconfirmed | Query `information_schema` for `course_observations`, `admin_audit_log` |
| 3 | Whether the three crons are firing | Schedules are configured; execution is not evidenced | Vercel cron logs |
| 4 | Real provider BLOCKED rate (STOP 2 gate: Tier-1 > 40% ⇒ halt) | Governs whether M19.6+ investment was justified | Query `course_observations` grouped by `fetch_status` and provider |
| 5 | 30-day replay result (STOP 3) | Required before any tracker exposure | Build replay tooling after EVT-01/EVT-02 are fixed |
| 6 | Email deliverability, SPF/DKIM/DMARC on the sending subdomain | §72 requirement; unverifiable from code | DNS + Resend dashboard |
| 7 | Lighthouse mobile Perf ≥90 / SEO ≥95 (M19.9 gate) | Tracker UI gate | Live run once the tracker renders content |

---

# Technical Debt

Items that are neither defects nor spec violations, recorded so they are not rediscovered later.

The in-repo worker instead of `apps/monitor` is a reasonable fit for Hobby-tier hosting, but it inherits the 300-second function ceiling, which caps how many courses can ever be observed per run. At `MONITOR_DAILY_FETCH_BUDGET=50` with concurrency 2, coverage of a few hundred published courses takes days — the §69.4 SLO of "≥95% observed at their tier" is unreachable at this ceiling regardless of code quality. This is the decision most likely to need revisiting in v1.3.

Provider-specific behaviour is spread across nine modules (`SEED_PROVIDER_POLICIES`, `PERMANENT_FREE_FULL_PROVIDERS`, `PROVIDER_PROFILES`, `BY_SLUG`/`BY_DOMAIN`, `PROVIDER_SHAPES`, `inferDomain`, `HIGH_TIER_PROVIDERS`, `providerTone`, URL normalization). Each is individually clean and none contains a stray inline provider check, but onboarding one provider means editing nine files — which is plausibly why zero of the six planned providers were onboarded. A single provider descriptor consolidating these would make §67.6 achievable.

Review priority uses a hardcoded `HIGH_TIER_PROVIDERS` set rather than a database tier, and omits the `free_durability` and staleness terms §79.5 specifies.

---

# P0 Findings

**None.**

Explicitly ruled out with evidence: admin authentication bypass (all 13 routes check session and role server-side); anonymous cron invocation (`verifyCronAuth` fails closed on unset secret); SSRF bypass on the course-fetch path (monitor reuses `fetchCourseSource`, with redirect re-validation at every hop); observation history corruption (no `UPDATE`/`DELETE` in application code); false alerts at scale (`FEATURE_PRICE_ALERTS` OFF, `EMAIL_DRY_RUN` on, `isPublic` never true); secret exposure (no keys logged; audit payloads bounded).

**This conclusion is conditional on verification item 1.** With `FEATURE_AUTO_STATUS=true` in production, MON-01 plus EVT-01 plus EVT-02 constitute undetectable, unattributable corruption of published course pricing, and the finding set becomes P0.

# P1 Findings

| ID | Finding | Blocks v1.3 |
|---|---|---|
| TRU-01 | `FREE_TRIAL` reaches free-labelled pages via `?price=`, `/best/*`, `/topic/*` | **YES** |
| TRU-02 | `provider_policies` table never read at runtime | **YES** |
| TRU-03 | `FREE_AUDIT` + `UNKNOWN` certificate reachable | **YES** |
| MON-01 | Worker state changes produce no audit record | **YES** |
| EVT-01 | Confirmation missing 2-hour spacing and extraction/confidence gate | NO (dormant) |
| EVT-02 | Region guard vacuous — region never populated, null matches null | NO (dormant) |
| EVT-05 | STOP 3 replay `NOT_VERIFIABLE` | NO (dormant) |
| TRU-04 | Auto-status can write `FREE_WITH_COUPON` past the MANUAL gate | NO (dormant) |
| DAT-01 | No DB uniqueness on `course_price_events`; SELECT-then-INSERT race | NO (dormant) |
| TRK-01 | Tracker queries `isPublic=true`, never set — permanently empty | NO |
| AUD-01 | Audit log not on every state change (M19.0 gate unmet) | **YES** |
| COV-01 | `discovery_rejections` and `junk_rate` never written — §67.5 loop dead | NO |

# P2 Findings

Nineteen findings: SEC-01 (watch rate limit), SEC-02 (plaintext tokens), SEC-03 (status disclosure), SEC-06 (Resend timeout), DAT-02 (bootstrap drift), DAT-03 (missing indexes), TRU-05 (partial discount), MON-02 (worker controls), MON-03 (`api_usage_log` coverage), EVT-03 (unemitted event types), EVT-04 (`CERT_CHANGED` auto-write), plus: bulk API without UI; undo not implemented; keyboard shortcuts not implemented; missing §74 env vars (`MONITOR_PER_DOMAIN_RPM`, `MONITOR_USER_AGENT`, `EMAIL_REPLY_TO`, `EMAIL_DAILY_BUDGET`, `MONITOR_DATABASE_URL`); `DISCOVERY_QUERY_LIMIT` still 15 vs spec 25; staleness thresholds diverge from §70.3; BLOCKED still shows a price; history empty-state rules absent; `/history`, `/collections/just-went-free`, RSS, and `/api/public/events` not implemented; RFC 8058 headers and bounce webhook absent; M19.3 backfill absent; six Group-A providers not onboarded; per-provider HTML fixtures absent.

# P3 Findings

Eleven findings: SEC-04 (`url-shape` EDITOR), SEC-05 (`candidates/[id]` ADMIN), DAT-04 (observation cascade), WIR-01 (dead code and unused exports), `FEATURE_PUBLIC_FEED` declared but unread, dashboard work list 3 of 7+, saved views not composable, `/tracker` absent from sitemap and navigation, email copy inline instead of dictionary-based, two hardcoded English metadata strings, and the two pre-existing lint warnings.

---

# Recommended Remediation Order

Detail, effort, and dependencies are in `docs/V1_2_REMEDIATION_PLAN.md`. Summary sequence:

1. **Verify the two feature-flag values in production.** Everything else depends on whether the severity model above holds. One dashboard check.
2. **R1 — before M20.0.** Truth leaks (TRU-01, TRU-03), DB-backed policies (TRU-02), and worker audit logging (MON-01/AUD-01). These four block v1.3 because semantic search will index and embed whatever the truth layer asserts.
3. **R2 — before enabling any tracker or alert flag.** EVT-01, EVT-02, TRU-04, DAT-01, TRK-01, SEC-01/02/03, then the STOP 3 replay (EVT-05) as the final gate.
4. **R3 — early v1.3.** Worker controls, `api_usage_log` coverage, env completeness, `DISCOVERY_QUERY_LIMIT`, bootstrap drift, indexes.
5. **R4 — backlog.** Remaining P2 UI surfaces and all P3 items.

---

# v1.3 Gate Decision

## `READY_WITH_REMEDIATION` — conditional

**The condition.** Confirm that `FEATURE_AUTO_STATUS` and `FEATURE_PRICE_ALERTS` are both unset or `"false"` in the production Vercel environment. If either is `"true"`, this decision changes to **`NOT_READY_FOR_V1_3`**, because worker-driven pricing changes are then occurring with two confirmation guards missing and no audit trail — meeting the P0 bar for both data corruption and truth failure.

**Assuming the condition holds**, the reasoning is:

There is no P0. All four quality gates pass. The security posture is genuinely solid — the areas that would most plausibly have failed (admin authorization, SSRF regression in a new worker, append-only violation) were all done correctly, and the M18.4 architecture was reused rather than duplicated, which is the single best structural decision in this release.

The twelve P1 findings split cleanly. Eight are dormant: they sit behind feature flags that default OFF and an `isPublic` value that is never set, so no user can currently be shown a wrong number. They must be fixed before the tracker or alerts are enabled, but they do not block work on v1.3.

Four do block v1.3, and they share one cause: **v1.3 Smart Discovery and semantic search will read, index, and embed the truth layer.** `FREE_TRIAL` leaking onto free-labelled pages, `FREE_AUDIT` rows carrying `UNKNOWN`, and a policy table that runtime ignores mean the embeddings would encode wrong labels. Correcting a search index after the fact costs far more than correcting a `WHERE` clause now. The audit gap belongs in the same group for a different reason: v1.3 adds more automated writes, and adding them on top of a base where worker changes are already untraceable compounds a problem the spec explicitly sequenced M19.0 to prevent.

**A note on what "M19 complete" should mean.** `docs/M19_FINAL_REPORT.md` marks the milestone `CORE_COMPLETE` and honestly lists its deferrals. This audit agrees with the deferrals as recorded, but the label understates the gap between structural presence and operation: roughly 40% of M19 is live. The remainder is not broken so much as never switched on — and several parts, such as the tracker's `isPublic` and the `junk_rate` loop, cannot be switched on without code changes. Worth restating in the plan so v1.3 is not built on an assumption that time intelligence is already running.

---

*Audit performed read-only. No source file, test, migration, or configuration was modified. No production resource was accessed. No remediation was implemented.*
