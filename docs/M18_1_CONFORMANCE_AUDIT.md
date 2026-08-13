# M18.1 — Project Plan Conformance Audit

Independent audit of the FreeLearn Radar repository against `project-plan.md`.

- Baseline commit state: working tree at audit time (no commits made by this audit).
- Source of truth: `project-plan.md`, plus explicitly documented architecture decisions
  (`docs/COURSE_VERIFICATION_ENGINE.md`, `docs/SECURITY.md`, `docs/SEO_ARCHITECTURE.md`).
- Previous milestone reports (M15–M18) were treated as **secondary evidence only** and
  were not used to mark anything as complete.
- Quality gates at audit start: `lint` PASS, `typecheck` PASS, `test` PASS (27 files / 126 cases).

---

## 1. Method

1. Read `project-plan.md` end to end and extracted a requirements matrix (§1–§64, WP0–WP14,
   AI Coding Rules 1–10, Master Instruction 1–17).
2. Reconstructed the actual system from code only: routes, middleware, domain services,
   repositories, Drizzle schema, SQL migrations, providers, cron, admin UI, public UI, tests.
3. Compared expected vs actual, then attacked the result adversarially (Phases 5–10, 20).

Negative requirements were given equal weight to positive ones. The plan's hard constraints are:

| Constraint | Plan reference |
| --- | --- |
| No auto-publish of AI output; human approval is the publish gate | §3, §29, Rule 7, Master 6 |
| AI assists, never decides | §58 Principle 3, Rule 3 |
| External web content is untrusted input; must not steer the system prompt | §37, Master 7 |
| Certificate status must not be inferred without evidence | §13 |
| Ranking must be deterministic; AI is one component only | §20 |
| No fake course data in production | Rule 9 |
| No secrets client-side; admin API authn+authz; cron verifies secret | §36 |
| Candidate and Course are two separate lifecycles | Master 13 |
| Hard batch limits to prevent API bill shock | §33 |
| Errors must not be silently swallowed | Rule 8 |

---

## 2. Findings summary

| Severity | Count | Definition |
| --- | --- | --- |
| P0 | 1 | Product / security / data-integrity blocker |
| P1 | 6 | Serious requirement mismatch |
| P2 | 7 | Important quality gap |
| P3 | 9 | Minor deviation |

---

## 3. P0 findings

### P0-01 — Production seed publishes 8 fabricated courses as verified

- **Plan reference:** AI Coding Rule 9 ("Không fake course data trong production");
  WP14 ("Seed production: providers, categories, discovery queries");
  §58 Principle 1 ("100 course được verify tốt hơn 10.000 link rác").
- **Expected:** The production seed installs reference data only — providers, categories,
  discovery queries, admin users. Published courses exist only after human approval or
  manual admin creation.
- **Actual:** `src/db/seed.ts:172` unconditionally calls `seedCourses`, which inserts the
  8 hand-written fixtures in `src/db/seed/courses.ts:27-188` with
  `status: "PUBLISHED"`, `publishedAt: now`, `lastVerifiedAt: now`
  (`src/db/seed.ts:152-154`). There is no `NODE_ENV` / `VERCEL` / opt-in flag guard anywhere
  in the file. `docs/PRODUCTION.md:44` and `docs/MANUAL_MORNING_CHECKLIST.md:60` explicitly
  instruct the operator to run `npm run db:seed` against the production database.
- **Difference:** The documented production procedure publishes fabricated catalog entries.
- **Impact:** On launch the public site, sitemap, JSON-LD, monthly "best of" page and
  `/course/[slug]/go` outbound redirects all serve invented courses whose free status and
  certificate status were never verified by any evidence path. `lastVerifiedAt = now`
  additionally suppresses the "Free status may be outdated" warning
  (`src/components/public/course-card.tsx:75-84`) and yields the maximum freshness score of
  100 in ranking (`src/domain/ranking/ranking.ts:41`). This is simultaneously a product
  integrity failure, an SEO liability, and a direct violation of Rule 9.
- **Evidence:** `src/db/seed.ts:109-163,165-175`; `src/db/seed/courses.ts:27-188`;
  `docs/PRODUCTION.md:44`.
- **Recommended fix:** Gate sample-course seeding behind an explicit opt-in environment flag
  and refuse it outright on production runtimes. Keep providers/categories/queries/admin
  seeding unconditional, as WP14 requires.

---

## 4. P1 findings

### P1-01 — AI can override the deterministic classifier's explicit "not free" verdict

- **Plan reference:** §12 (price enum semantics), §13 ("Không được suy luận certificate nếu
  source không đủ evidence"), §58 Principle 3, Rule 3, Master 6;
  `docs/COURSE_VERIFICATION_ENGINE.md:18` ("AI never … overrides strong deterministic evidence").
- **Expected:** Where the deterministic classifier has actively judged the evidence
  insufficient for a free claim, that judgement stands. AI may only fill a genuine gap.
- **Actual:** `classifyFreeStatusFromText` distinguishes two different `UNKNOWN` outcomes but
  `resolvePriceType` treats them identically. Ambiguous marketing copy
  ("learn for free", "get started for free") returns
  `{ priceType: "UNKNOWN", confidence: 0.35, rationale: "Ambiguous marketing free language —
  insufficient for FREE_FULL" }` (`src/domain/verification/free-status.ts:176-184`), and a
  free preview returns `UNKNOWN` at 0.4 (`:149-156`). Because both are `UNKNOWN` with
  confidence `< 0.7`, `resolvePriceType` adopts the AI suggestion whenever
  `aiConfidence >= 0.7` (`:239-251`) — including `FREE_FULL`. The identical hole exists in
  `resolveCertificateType` (`src/domain/verification/certificate-status.ts:123-135`), where the
  deliberate "certificate mentioned without free/paid clarity — prefer UNKNOWN" verdict
  (`:91-99`) can be upgraded by AI to `FREE_CERTIFICATE`.
- **Difference:** A deterministic *rejection* is being read as a *gap*.
- **Impact:** The AI is the deciding authority for the product's headline claim. A page that
  merely says "start learning for free" plus a confident model becomes a
  green "100% Free" badge (`src/components/public/free-status-badge.tsx`) at approval time
  (`src/domain/candidate/approve-candidate.ts:135-151`) and at every recheck
  (`src/domain/verification/verification-service.ts:94-104`). Directly answers the adversarial
  question "Can UNKNOWN become FREE accidentally?" with **yes**. Certificate side additionally
  violates §13 verbatim.
- **Evidence:** `src/domain/verification/free-status.ts:149-156,176-184,239-251`;
  `src/domain/verification/certificate-status.ts:91-99,123-135`.
- **Recommended fix:** Only adopt an AI enum when the deterministic pass found *no* signals at
  all. When the classifier matched signals and still refused to classify, that refusal wins.

### P1-02 — Verification refreshes the "last verified" clock without verifying anything

- **Plan reference:** §44 (verification strategy), §58 Principle 4 ("Một khóa từng free 6 tháng
  trước không có nghĩa hôm nay vẫn free"), §24 ("Last Verified" on course detail).
- **Expected:** `last_verified_at` means "we re-checked this course's free status on this date".
- **Actual:** `produceVerificationResult` returns `updateCourse: shouldUpdateFields || true`
  (`src/domain/verification/verification-service.ts:229`). The `|| true` makes the computed
  `shouldUpdateFields` dead, so `persistVerification` always writes
  `lastVerifiedAt: result.observedAt` (`src/domain/verification/verify-batch.ts:180-187`) and
  the verification row is always recorded as `VERIFIED` (`:219-222`). The live evidence
  gatherer falls back to `text: text || course.title`
  (`src/app/api/cron/verify/route.ts:41-49`), so a Tavily result containing only the course
  title yields `priceType: UNKNOWN` at confidence 0.2 — no pricing evidence whatsoever — and
  the course is still stamped as freshly verified.
- **Difference:** A failed price re-check is recorded as a successful verification.
- **Impact:** Stale information is presented as verified. The public "Verified N days ago"
  line and the staleness warning (`src/components/public/verification-freshness.tsx`,
  `src/components/public/course-card.tsx:75-84`) become meaningless; the freshness component
  of the ranking score is permanently pinned at 100
  (`src/domain/ranking/ranking.ts:41`); and `computeRecheckPriority`'s
  `previousVerificationFailed` signal never fires, so genuinely unverifiable courses are never
  prioritised for re-checking. Answers "Can stale information appear as verified?" with **yes**.
- **Evidence:** `src/domain/verification/verification-service.ts:214-229`;
  `src/domain/verification/verify-batch.ts:180-187`; `src/app/api/cron/verify/route.ts:41-49`.
- **Recommended fix:** Treat a verification as conclusive only when the evidence produced a
  usable price classification or a definitive availability signal. Otherwise record `FAILED`
  and leave `last_verified_at` untouched.

### P1-03 — Manual add pipeline (§30) is not implemented

- **Plan reference:** §30 ("Admin paste URL → fetch/search → extract → AI analyze → preview →
  confirm. Đây là fallback cực quan trọng. Nếu automation chết vẫn publish course được.");
  WP4; §50 E2E "Manual course creation".
- **Expected:** `/admin/courses/new` accepts a URL and drives the ingest pipeline, showing an
  AI-assisted preview before the admin confirms.
- **Actual:** `/admin/courses/new` renders a plain 20-field data-entry form
  (`src/app/admin/courses/new/page.tsx:52-56`, `src/components/admin/course-form.tsx`). There
  is no URL field, no fetch/search step, no analyze step, and no preview step. The helper that
  was evidently written for this flow, `getOrCreateManualCandidate`
  (`src/domain/candidate/candidate-service.ts:86-102`), is never called from anywhere in the
  application, and `source_type = "MANUAL"` is consequently never written to the database.
- **Difference:** The documented fallback path exists as a generic CRUD form, not as the
  specified pipeline.
- **Impact:** The plan's stated resilience property ("if automation dies you can still publish")
  is only satisfied at the cost of the admin hand-transcribing every field, and the manual
  path bypasses prefilter, URL normalization, duplicate detection and evidence capture that
  the discovery path applies. Manual courses therefore have no verification row and no evidence
  history.
- **Evidence:** `src/app/admin/courses/new/page.tsx:12-61`;
  `src/domain/candidate/candidate-service.ts:86-102` (zero callers).
- **Recommended fix:** Requires a dedicated implementation milestone (new admin analyze-URL
  endpoint + preview step reusing `getOrCreateManualCandidate` and `analyzeCandidate`).
  **Not remediated in M18.1** — building it here would be new feature work outside audit scope.

### P1-04 — Discovery admin ignores the topic/provider controls the plan requires

- **Plan reference:** §31 (`/admin/discovery` — Topic, Provider, Limit, Run);
  §8 (query matrix, daily topic rotation).
- **Expected:** An admin can scope a manual discovery run to a topic and provider.
- **Actual:** `POST /api/admin/discovery/run` declares and validates `provider` and `category`
  in its Zod schema (`src/app/api/admin/discovery/run/route.ts:15-20`), parses them
  (`:32`), and then never passes them to `runDiscoveryBatch` (`:47-50`) — only `limit` and
  `resultLimit` are used. `runDiscoveryBatch` has no provider/category parameter at all
  (`src/domain/discovery/discovery-engine.ts:35-42`). The UI sends neither field and renders no
  selectors, only a bare "Run Discovery" button
  (`src/components/admin/discovery-run-form.tsx:18-22,49-62`).
- **Difference:** Two required controls are missing from the UI and silently discarded by the API.
- **Impact:** The plan's stated purpose for this screen — "cho phép test pipeline mà không phải
  chờ Cron", scoped by topic/provider — cannot be met. The API contract is misleading: a caller
  supplying `provider: "coursera"` receives HTTP 200 and a full unscoped run. This is a
  dead/fake implementation of a documented product surface.
- **Evidence:** `src/app/api/admin/discovery/run/route.ts:15-20,32,47-50`;
  `src/domain/discovery/discovery-engine.ts:35-62`;
  `src/components/admin/discovery-run-form.tsx:18-22`.
- **Recommended fix:** Filter due discovery queries by provider/category in the query service,
  thread the parameters through `runDiscoveryBatch`, and expose the two selectors in the form.

### P1-05 — WP13's required security tests do not exist

- **Plan reference:** WP13 (test "unauthorized admin access", "cron auth", …);
  §50 Integration/E2E; Master 14.
- **Expected:** Authorization and cron authentication are covered by tests.
- **Actual:** No test in the repository imports any file under `src/app/**/route.ts`.
  0 of 11 route handlers are executed by the suite. There is no test for an unauthenticated
  or wrong-role request against any admin API, none for `src/middleware.ts`, none for the cron
  endpoints, and none for `/course/[slug]/go`. `requireRole`
  (`src/lib/auth/guards.ts:37-44`) is not used by any route and is untested; every route
  inline-checks `session.role` instead. `src/test/health.test.ts:4-25` asserts on objects it
  constructs inside the test and cannot fail.
- **Difference:** The security properties are implemented but unverified; a regression that
  removes a role check would not fail CI.
- **Impact:** Weak assurance for the plan's highest-risk requirement (§36). Also means the
  "tests pass" signal in previous milestone reports does not evidence WP13 completion.
- **Evidence:** repository-wide — no `from "@/app/` or route-handler import in any `*.test.ts`;
  `src/test/health.test.ts:4-25`.
- **Recommended fix:** Add route-handler tests for admin 401/403, cron 401, and outbound
  redirect safety.

### P1-06 — Re-publishing a course resets its "last verified" clock (found in the Phase 23 pass)

- **Plan reference:** §44, §58 Principle 4, §24 — same requirement as P1-02.
- **Expected:** Only an actual verification writes `last_verified_at`.
- **Actual:** `POST /api/admin/courses/[id]/status` wrote
  `lastVerifiedAt: body.status === "PUBLISHED" ? now : existing.lastVerifiedAt`
  (`src/app/api/admin/courses/[id]/status/route.ts:55-56`). Any transition into `PUBLISHED`
  — including re-publishing a course that was expired or unavailable for months — stamped the
  clock with `now`. The sibling edit endpoint already used the correct
  `existing.lastVerifiedAt ?? new Date()` form (`src/app/api/admin/courses/[id]/route.ts:89-90`),
  so the two endpoints disagreed.
- **Difference:** A status change was being recorded as a verification event, with no evidence
  row to back it.
- **Impact:** Identical to P1-02 but reachable straight from the admin UI: the public
  "Verified N days ago" line, the staleness warning and the freshness component of the ranking
  score could all be reset by a status toggle. This is also the exact loophole that survives
  the P1-02 fix, which is why the second pass was worth running.
- **Evidence:** `src/app/api/admin/courses/[id]/status/route.ts:55-56`.
- **Recommended fix:** Preserve the existing timestamp; stamp it only on first publication,
  matching the `publishedAt` semantics in the same statement.

---

## 5. P2 findings

### P2-01 — Duplicate-approval marking is rolled back by its own transaction

`approveCandidate` detects that the canonical URL is already published, writes
`discoveryStatus: "DUPLICATE"` to the candidate, and then throws — all inside
`db.transaction` (`src/domain/candidate/approve-candidate.ts:156-171`). The throw rolls the
transaction back, discarding the `DUPLICATE` marking. The candidate stays `READY_FOR_REVIEW`
and re-surfaces in the review queue forever, showing the same error on every retry.
**Fix:** persist the duplicate marking after the transaction unwinds.

### P2-02 — Catalog "Recommended"/"Newest"/"Most popular" sorts put unranked courses first

`sortExpression` orders by `desc(courses.qualityScore)`, `desc(courses.publishedAt)` and
`desc(courses.ratingCount)` (`src/db/repositories/course-repository.ts:44-56`). PostgreSQL
defaults to `NULLS FIRST` for `DESC`, so courses with no quality score rank **above** a course
scored 95 on every category, search, provider, topic and collection page. `ratingCount` is
never written by any code path, so "Most popular" orders an entirely NULL column.
**Fix:** `NULLS LAST` plus deterministic tiebreakers.

### P2-03 — Catalog "Recommended" is raw AI score, not the deterministic ranking score

§20 requires ranking to be a deterministic weighted composite in which AI contributes one
component. The homepage honours this (`src/app/page.tsx:91` → `rankCourses`), but every
paginated catalog surface sorts on `courses.quality_score` alone
(`src/db/repositories/course-repository.ts:54`), which `approveCandidate` copies straight from
`analysis.quality_score` (`src/domain/candidate/approve-candidate.ts:201-203`). On those pages
the model's self-reported score is the sole ranking authority.
**Fix (deferred):** persist a materialised ranking score or sort in the domain layer; a full
SQL implementation of §20 is a design change, out of scope for this audit. Partially mitigated
by P2-02's fix.

### P2-04 — Search does not cover categories

§26 lists the search fields as `title, description, categories, provider`. The implementation
covers title, description, short description and provider name only
(`src/db/repositories/course-repository.ts:69-79`). Searching "cybersecurity" misses courses
categorised as Cybersecurity whose text never uses the word.

### P2-05 — Public recommendation labels are never rendered

§19 requires the public UI to express AI score as `Recommended` / `Highly Recommended` /
`Worth Exploring`, and §23's card mock-up shows `⭐ Recommended`.
`getRecommendationLabel` exists (`src/domain/course/recommendation.ts:6-20`) and is tested, but
no component imports it. `src/components/public/course-card.tsx` renders no recommendation
signal at all.

### P2-06 — "Edit + approve" is missing from candidate review

WP8 requires `approve`, `edit + approve`, `reject`, `re-analyze`. The API fully supports
overrides (`src/app/api/admin/candidates/[id]/route.ts:64-113`), but `CandidateActions`
(`src/components/admin/candidate-actions.tsx:49-76`) exposes only Approve / Reject /
Re-analyze and never sends `overrides`. §29's `[Edit]` action does not exist. The reviewer
cannot correct a wrong AI price classification before publishing — they must approve first and
then edit the published course.

### P2-07 — Course detail is missing four specified sections

§24 requires `AI Summary`, `What You'll Learn`, `Who Is This For?`, `Prerequisites`. None are
rendered, and the `courses` table has no columns for them (`src/db/schema/courses.ts:20-57`),
so this is a data-model gap as well as a UI gap. `analysis.pros` / `analysis.cons` /
`analysis.why_learn` are captured by the AI schema
(`src/services/ai/ai-provider.ts:32-35`) but only `why_learn` and `summary_vi` survive
approval, collapsed into `short_description` / `description`.

---

## 6. P3 findings

| ID | Finding | Evidence |
| --- | --- | --- |
| P3-01 | Hero copy and CTA differ from §57 (`Learn more. Spend $0.` / `Explore Free Courses`); H1 is the brand name. | `src/app/page.tsx:119-125` |
| P3-02 | Admin dashboard lacks `Candidates Today`, `Expired`, and a distinct `AI Errors` tile (§28); "Discovery Errors" actually counts candidates in `ERROR`, which is the AI-failure state. | `src/app/admin/page.tsx:24-58` |
| P3-03 | The 7 performance indexes in `drizzle/0001_add_query_indexes.sql` are absent from the Drizzle TS schema, so a future `drizzle-kit generate` would propose dropping them. | `drizzle/0001_add_query_indexes.sql:1-20` vs `src/db/schema/*.ts` |
| P3-04 | `ADMIN_EMAILS` and `ADMIN_BOOTSTRAP_PASSWORD` are validated by `getServerEnv` but consumed only through direct `process.env` reads in the seed script. | `src/lib/env.ts:17-18`; `src/db/seed.ts:77-78` |
| P3-05 | `%` and `_` are not escaped before being interpolated into `ILIKE` patterns; a query of `%` matches everything. Parameterised, so not injectable. | `src/db/repositories/course-repository.ts:70` |
| P3-06 | Tavily and NVIDIA clients retry on `401`, wasting two extra calls on a permanent auth failure. | `src/services/search/tavily-search-provider.ts:57,119-122`; `src/services/ai/nvidia-nim-provider.ts:59-71` |
| P3-07 | `withDb` converts any database failure into an empty page with HTTP 200 rather than an error state; logged, so not silent, but a full outage renders as "no courses". | `src/lib/db-safe.ts:9-17` |
| P3-08 | Course status enum uses `DRAFT`/`PUBLISHED` where §43 names `ACTIVE`; `EXPIRED`/`UNAVAILABLE`/`ARCHIVED` match. Deliberate and consistent, but undocumented as a deviation. | `src/db/schema/enums.ts:5-11` |
| P3-09 | `/admin/courses/[id]` and `POST /api/admin/courses` write course rows and category rows in two separate statements without a transaction. | `src/app/api/admin/courses/route.ts:55-77` |

---

## 7. WP0–WP14 verification

Verified from code, not from previous reports.

| WP | Verdict | Basis |
| --- | --- | --- |
| WP0 Foundation | IMPLEMENTED_CORRECTLY | Next.js App Router + strict TS (`tsconfig.json`), Tailwind v4, shadcn primitives, Drizzle, Zod env validation with production secret enforcement (`src/lib/env.ts:53-64`), vitest, CI running all four gates (`.github/workflows/ci.yml`). All four gates pass locally. |
| WP1 Database | IMPLEMENTED_WITH_GAPS | All 9 tables present with correct PKs, FKs, unique indexes on `courses.slug`, `courses.canonical_url`, `course_candidates.canonical_url`; migrations match the TS schema field-for-field. Gaps: P3-03 index drift, unused `rating`/`price`/`logo_url` columns, seed publishes fixtures (P0-01). |
| WP2 Admin auth | IMPLEMENTED_WITH_GAPS | JWT session via `jose` HS256 with role validation (`src/lib/auth/session.ts:45-61`), bcrypt passwords, middleware guarding `/admin` and `/api/admin` (`src/middleware.ts:12-74`), per-route role checks, login rate limiting. Gap: no authorization tests (P1-05); `requireRole` unused. |
| WP3 Public catalog | IMPLEMENTED_WITH_GAPS | `/`, `/course/[slug]`, `/category/[slug]`, `/search` all exist with filters, sort and pagination. Gaps: P2-02, P2-03, P2-04, P2-05, P2-07, P3-01; no Language filter in the UI although the backend supports it. |
| WP4 Admin course mgmt | IMPLEMENTED_WITH_GAPS | `/admin`, `/admin/courses`, `/admin/courses/new`, `/admin/courses/[id]` with create/edit/publish/unpublish/archive and a real status transition guard (`src/domain/course/transitions.ts:17-23`). Site works without AI. Gaps: P1-03, P3-02, P3-09. |
| WP5 Search provider | IMPLEMENTED_CORRECTLY | `SearchProvider` interface with `TavilySearchProvider` behind it, `AbortController` timeout, bounded retries with backoff, post-hoc domain filtering, injected `fetchImpl` for tests; 6 mocked-HTTP tests covering timeout/401/429/500. No `fetch` to Tavily exists outside `src/services/`. |
| WP6 Discovery engine | IMPLEMENTED_WITH_GAPS | Query rotation via `next_run_at` (`src/domain/discovery/discovery-query-service.ts:10-62`), URL normalization, duplicate detection against both candidates and courses, per-query error isolation. Gap: P1-04; the COURSE-duplicate branch is untested. |
| WP7 NVIDIA AI | IMPLEMENTED_WITH_GAPS | `AIProvider` interface, Zod-validated structured JSON, `response_format: json_object`, exactly one retry (§18), `AI_PARSE_ERROR` on malformed output, failure recorded as candidate `ERROR` without crashing discovery. Gap: P1-01 — the provider is fine, but downstream the AI outranks a deterministic verdict. |
| WP8 Candidate review | IMPLEMENTED_WITH_GAPS | `/admin/candidates` and `/admin/candidates/[id]` with approve/reject/re-analyze; course creation is transactional and re-checks candidate state inside the transaction. Gaps: P2-01, P2-06; list card omits the AI classification fields §29 requires (they appear only on the detail page). |
| WP9 Ranking | IMPLEMENTED_WITH_GAPS | §20 weights and §21 freshness bands implemented exactly and unit-tested (`src/domain/ranking/ranking.ts:16-46`), used by the homepage and the monthly collection. Gaps: P2-02, P2-03 — catalog pages bypass it. |
| WP10 Cron discovery | IMPLEMENTED_CORRECTLY | `/api/cron/discover` with `CRON_SECRET` bearer/header check that fails closed on an unset secret (`src/lib/cron-auth.ts:5-7`), daily schedule in `vercel.json`, query rotation, and hard limits from §33 (`DISCOVERY_QUERY_LIMIT`, `DISCOVERY_RESULT_LIMIT`, `AI_ANALYSIS_LIMIT`). Worst case per run is bounded at 15 searches / 75 candidates / 30 AI calls. |
| WP11 Outbound tracking | IMPLEMENTED_CORRECTLY | `/course/[slug]/go` records the click, never blocks the redirect on an analytics failure, re-validates the destination with `assertSafeHttpUrl` before a 302, and falls back to the course page on an unsafe URL. `outbound_clicks` stores no raw IP (§39). Admin analytics covers top courses/providers/categories. |
| WP12 SEO | IMPLEMENTED_CORRECTLY | Per-page metadata with canonicals and OpenGraph, JSON-LD builders, `sitemap.ts` restricted to `PUBLISHED` courses, `robots.ts` disallowing `/admin` and `/api/`, `X-Robots-Tag: noindex` headers for both, non-published course pages set `robots.index: false`, and `/best/[year]/[month]` exists with the specified title format. |
| WP13 Reliability & security | IMPLEMENTED_WITH_GAPS | Most listed risks are handled in code (URL safety, prompt-injection containment, malformed AI JSON, Tavily failures, duplicate URLs, no `dangerouslySetInnerHTML` outside JSON-LD, no `NEXT_PUBLIC_` secrets). Gap: P1-05 — the *tests* WP13 asks for are absent for admin authz, cron authz and the redirect route. |
| WP14 Production | CANNOT_VERIFY_WITHOUT_LIVE_ENVIRONMENT | Config is present (`vercel.json`, env schema, docs). The documented seed procedure is unsafe (P0-01). Deployment, Neon connectivity, live cron delivery and smoke tests cannot be verified from the repository. |

---

## 8. Business logic lifecycle audit (Phase 5)

Traced: search result → candidate → normalize → dedupe → AI → review → approve → course →
verify → rank → display → click.

| Question | Answer | Evidence |
| --- | --- | --- |
| Can a candidate bypass human review? | **No.** The only writer of a `PUBLISHED` course besides the admin CRUD API is `approveCandidate`, reachable solely from `POST /api/admin/candidates/[id]` behind middleware + `role === "ADMIN"`. | `src/app/api/admin/candidates/[id]/route.ts:21-28,64-113` |
| Can AI cause automatic publication? | **No.** `analyzeCandidate` can only move a candidate to `READY_FOR_REVIEW`, `ANALYZED`, `INVALID` or `ERROR`. Cron never approves. | `src/domain/candidate/analyze-candidate.ts:84-100` |
| Can invalid state transitions occur? | Course transitions are guarded by an explicit table; candidate approval is restricted to `READY_FOR_REVIEW`/`ANALYZED` and re-checked inside the transaction. | `src/domain/course/transitions.ts:17-50`; `approve-candidate.ts:173-176` |
| Can duplicate courses be created? | **No.** Unique indexes on `courses.canonical_url` and `courses.slug` backstop the application checks, and the approval re-check runs inside the transaction. | `src/db/schema/courses.ts:59-62` |
| Can approval partially succeed? | Course + categories + verification + candidate update are one transaction. **But** the duplicate branch's candidate marking is rolled back (P2-01). | `approve-candidate.ts:156-252` |
| Can UNKNOWN become FREE accidentally? | **Yes** — P1-01. | `free-status.ts:239-251` |
| Can stale info appear as verified? | **Yes** — P1-02, and P0-01 for seeded rows. | `verification-service.ts:229` |
| Can failed AI analysis leave inconsistent state? | No. Failure writes `ERROR` + message; no partial analysis is persisted. | `analyze-candidate.ts:101-114` |
| Can concurrent approval double-publish? | No. Two concurrent approvals compute the same slug before the transaction; the loser hits the `courses_slug_unique` violation and rolls back entirely. | `approve-candidate.ts:104-113`; `courses.ts:60` |
| Can retry create duplicate state? | Discovery re-ingest is caught by the candidate unique index and the per-query error handler; the query is marked failed and the batch continues. | `discovery-engine.ts:81-89` |

---

## 9. AI trust boundary audit (Phase 6)

Every entry point of model output was traced to persistence or display.

| Check | Result |
| --- | --- |
| AI output treated as untrusted | Partial. Zod-validated at the boundary, but see P1-01 for excess authority downstream. |
| AI cannot publish directly | Pass. |
| AI cannot bypass human approval | Pass. |
| Classifications validated | Pass — strict enums, `safeParse`, no coercion (`src/services/ai/ai-provider.ts:3-38`). |
| Malformed JSON fails safely | Pass — one salvage attempt for a wrapped object, then `AI_PARSE_ERROR`; max 1 retry per §18. |
| Unknown enum values fail safely | Pass — a hallucinated `TOTALLY_FREE_FOREVER` is rejected wholesale, not defaulted. |
| Prompt injection contained | Pass — the system prompt is a fixed constant, external text is wrapped in `<external-content>` with the delimiters stripped from the payload and NUL bytes removed, and content is truncated to 12 000 chars (`ai-provider.ts:56-82`). |
| AI confidence not treated as truth | Partial. `AI_CONFIDENCE` is documented as a self-report and used only for routing/capping (`src/domain/quality/confidence.ts:1-10`), which is correct — but P1-01 lets that self-report decide the free label. |
| Deterministic rules override AI | **Fails for the ambiguous/weak-evidence cases** — P1-01. |

Additional observation: the model-supplied `provider` and `title` strings are written back onto
the candidate (`analyze-candidate.ts:98-99`) and `analysis.quality_score` is copied into both
`quality_score` and `ai_score` (`approve-candidate.ts:201-203`). Both are subsequently used for
ordering (P2-03). This is within "AI assists", but it does mean the model influences ranking
more than §20 intends on non-homepage surfaces.

---

## 10. Search / discovery audit (Phase 7)

- Provider abstraction respected — no direct Tavily/NVIDIA `fetch` exists outside `src/services/`.
- External URLs validated twice: `isValidHttpUrl` on ingest and `assertSafeHttpUrl` on
  normalization, approval and redirect. `javascript:`, `data:`, `file:`, `vbscript:`,
  protocol-relative and control-character URLs are rejected.
- Duplicates normalized: `utm_*`, `fbclid`, `gclid`, `mc_*`, `ref`, `source` stripped;
  protocol forced to https; `www.` and trailing slashes removed; unique index on the result.
- Bad results filtered by `prefilterCandidate` before any AI spend.
- Search failure is isolated per query and recorded as a query failure with a 6-hour backoff.
- Cost is bounded: 15 queries × 5 results = 75 candidates, and at most 30 AI calls per run.
  A repeat analysis of unchanged content is skipped for 72 hours via a content hash.
- Weakness: retrying a `401` (P3-06), and `include_domains` is honoured only as a post-filter,
  so a provider that ignores the parameter costs a full search with zero usable results.

---

## 11. Security model audit (Phase 9)

Traced request paths rather than searching for helper names.

| Area | Result |
| --- | --- |
| Authentication | HS256 JWT in an `httpOnly`, `sameSite=lax`, `secure`-when-https cookie; the secret is required to be ≥ 32 chars in production. |
| Admin authorization | Middleware rejects unauthenticated `/api/admin/*` with 401 and redirects `/admin/*`; each route then enforces ADMIN or ADMIN|EDITOR. Candidate approval and discovery runs are ADMIN-only. |
| IDOR | Admin resources are keyed by UUID and every mutation re-loads the row server-side; there is no per-tenant data, so horizontal IDOR does not apply. |
| Cron authentication | Fails closed when `CRON_SECRET` is unset; accepts `Authorization: Bearer` (what Vercel sends) or `x-cron-secret`. |
| Input validation | Zod on every admin body; `courseFormSchema` rejects non-http(s) URLs. |
| Output encoding / XSS | React escaping everywhere; the only `dangerouslySetInnerHTML` is JSON-LD built from typed fields. No external HTML is rendered. |
| SSRF | The server never fetches an arbitrary course URL — it only calls Tavily and NVIDIA at fixed hosts. |
| Open redirect | `/course/[slug]/go` redirects only to a destination derived from stored course/provider fields and re-validated immediately before the 302. |
| Secret handling | No `NEXT_PUBLIC_` secret; no secret is logged; `.gitignore` excludes `.env*`. |
| Prompt injection | See Phase 6. |
| Mass assignment | Admin payloads are explicitly mapped field-by-field into repository calls; `status` is constrained by enum and by the transition guard. |

Residual risk: login rate limiting is per-instance in-memory
(`src/lib/rate-limit.ts:6-11`) and therefore ineffective across serverless instances. This is
documented in the code and acceptable for the MVP, but it is not a real control.

---

## 12. Failure path audit (Phase 10)

| Scenario | Behaviour | Valid state? |
| --- | --- | --- |
| Database unavailable (public pages) | `withDb` logs and renders the empty state, HTTP 200 | Yes (P3-07 notes the UX) |
| Database unavailable (admin) | Dashboard shows "Database not ready"; API returns 500 | Yes |
| DB write fails mid-approval | Whole transaction rolls back | Yes |
| Unique constraint violation | Surfaces as a 400 with the driver message | Yes |
| Tavily timeout / 401 / 429 / 500 | 3 bounded attempts, then the query is marked failed; batch continues | Yes |
| NVIDIA timeout / 401 / 429 / 500 | 1 retry then candidate `ERROR` with message; discovery is unaffected | Yes |
| NVIDIA returns invalid JSON | `AI_PARSE_ERROR`, candidate `ERROR` | Yes |
| Course URL unavailable | Verification records `UNAVAILABLE`; the course page keeps its URL and shows the unavailable banner | Yes |
| Cron runs twice | Both runs read the same due queries and duplicate the search spend; candidate inserts collide on the unique index and are absorbed as query failures | Yes, but wasteful (P3) |
| Two concurrent approvals | Loser fails on `courses_slug_unique` and rolls back | Yes |
| Two discovery jobs find the same course | Second is classified `DUPLICATE` | Yes |

---

## 13. Over- / under-engineering (Phases 13–14)

**Over-engineering**

| Item | Verdict |
| --- | --- |
| Verification engine (trust, priority, evidence, change detection, expiration) | JUSTIFIED — §44 and §58 Principle 4 demand it, and it is the product's differentiator. |
| Barrel `index.ts` files in `src/domain/*` and `src/db/repositories` | REMOVE/SIMPLIFY — none are imported anywhere; every caller imports leaf modules. `src/domain/provider/index.ts` is literally `export {}`. |
| `title-similarity.ts` + `evaluateSoftDuplicateHint` | QUESTIONABLE — tested, but no runtime caller; the soft-duplicate hint is never shown to an admin. |
| `certificateValue`, `findRelatedCourses`, `searchCourses`, `listBestCourses`, `listCoursesByProviderSlug`, `countVerifications`, `listFailedRecentVerifications`, `findUserById`, `listUsers` | QUESTIONABLE — exported, never called. |
| `getOrCreateManualCandidate`, `markCandidateDuplicate` | REMOVE or WIRE — dead, and their absence is exactly P1-03/P2-01. |

**Under-engineering**

| Item | Note |
| --- | --- |
| Course + categories written without a transaction in admin CRUD | P3-09 |
| No test coverage at the HTTP boundary | P1-05 |
| `ratingCount` drives a sort and a ranking component but is never written | P2-02 |
| Verification `trustState` is computed then discarded — never persisted or displayed | Public UI relies on `lastVerifiedAt` alone, which is why P1-02 is invisible to users |

---

## 14. Scope audit (Phase 15)

Surfaces present that `project-plan.md` never asked for:

| Addition | Classification |
| --- | --- |
| `/provider/[slug]` | BENEFICIAL_EXTENSION — consistent with §41/§42 SEO goals. |
| `/free-courses/[topic]`, `/free-certificate-courses` | BENEFICIAL_EXTENSION — SEO landing pages aligned with §27's intent. |
| `/collections/[slug]` (duration buckets) | HARMLESS. |
| Share button, brand mark, page shell, design-system docs | HARMLESS. |
| `/api/cron/verify` + verification engine (M16) | BENEFICIAL_EXTENSION — explicitly recorded in `project-plan.md` §49 M16 and `docs/COURSE_VERIFICATION_ENGINE.md`. |
| Verification-freshness copy on public cards | BENEFICIAL_EXTENSION — supports §58 Principle 4. |
| `product-events.ts` analytics stub | HARMLESS. |

No addition **conflicts** with the product. The MVP is not distorted by M15–M18 work; the
distortions found are omissions and the trust-boundary defects above, not scope creep.

---

## 15. M15–M18 regression review (Phase 12)

- **Architecture drift:** none material. Provider abstractions, repository layer and the
  candidate/course lifecycle separation all still hold.
- **Business rule drift:** one. The M16 "AI fills gaps" rule
  (`docs/COURSE_VERIFICATION_ENGINE.md:92`) was implemented in a way that also overrides
  deterministic *rejections* (P1-01). The documented decision does not authorise that, so this
  is an implementation defect rather than an intentional supersession.
- **Security drift:** none. M15 hardening (URL safety, transitions, rate limiting) is intact.
- **SEO/route drift:** M17 added routes; none removed or renamed an existing public URL, and
  the sitemap/robots rules still exclude admin, API and unpublished content.
- **UI exposing internal concepts:** `/admin/candidates/[id]` shows raw AI JSON and status
  codes — correct for admin, and none of it leaks to the public surface. Public pages show no
  numeric AI score, satisfying §19.

---

## 16. Configuration audit (Phase 17)

| Variable | Defined | Documented | Validated | Consumed | Fails safely |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | yes | yes | required, non-empty | `src/db/index.ts:18` | yes — throws |
| `TAVILY_API_KEY` | yes | yes | optional | provider ctor + cron/admin guards | yes — 503 with `pendingManualIntegrationTest` |
| `NVIDIA_API_KEY` | yes | yes | optional | provider ctor + route guards | yes — 503 / skipped analysis |
| `NVIDIA_BASE_URL` | yes | yes | URL, defaulted | provider ctor | yes |
| `NVIDIA_MODEL` | yes | yes | optional | provider ctor with fallback | yes |
| `AUTH_SECRET` | yes | yes | ≥ 32 chars in production | session signing | yes — throws at startup, and login returns a distinct 500 |
| `ADMIN_EMAILS` | yes | yes | optional | seed only, via raw `process.env` | P3-04 |
| `ADMIN_BOOTSTRAP_PASSWORD` | yes | yes | optional | seed only, via raw `process.env` | P3-04 |
| `CRON_SECRET` | yes | yes | ≥ 16 chars in production | both cron routes | yes — fails closed |
| `APP_URL` | yes | yes | URL, defaulted | metadata, sitemap, robots, cookie `secure` | yes |
| `DISCOVERY_QUERY_LIMIT` / `DISCOVERY_RESULT_LIMIT` / `AI_ANALYSIS_LIMIT` | yes | yes | positive int | discovery + analysis | yes |
| `MAX_VERIFICATIONS_PER_RUN` | yes | partly (absent from `docs/PRODUCTION.md`) | positive int | verify cron | yes |

No documented-but-unused variable, no used-but-undocumented variable, and no
production-dangerous default. The only unsafe default in the tree is the sample
`ADMIN_BOOTSTRAP_PASSWORD=change-me-in-production` in `.env.example`, which is example data.

---

## 17. Route & runtime audit (Phase 18)

21 routes: 12 public pages, 2 metadata routes, 1 icon route, 1 redirect route, 3 cron/health
APIs, 7 admin APIs, 8 admin pages. No duplicates, no orphans, no unprotected admin endpoint —
`/api/admin/*` is covered by both the middleware matcher and per-route role checks;
`/api/admin/auth/login` and `/logout` are intentionally exempt from the middleware and are the
only public admin endpoints.

Server/client boundaries are correct: every page is a server component except four `"use client"`
interaction components, and no secret-reading module is imported into a client component.

Caching: the homepage and all admin pages are `force-dynamic`; `/collections/[slug]` and
`/free-courses/[topic]` pre-render params. No page uses `revalidate`, so §41's "SSR/ISR
friendly" is satisfied by SSR only — acceptable, but every course page is rendered on demand.

---

## 18. Vercel compatibility (Phase 19)

| Aspect | Classification |
| --- | --- |
| No filesystem writes, no local state beyond the in-memory rate-limit map | CODE_VERIFIED |
| No long-running or background processes; cron work is bounded by §33 limits | CODE_VERIFIED |
| `vercel.json` declares two daily crons matching two existing routes | CODE_VERIFIED |
| Cron auth accepts Vercel's `Authorization: Bearer $CRON_SECRET` | CODE_VERIFIED |
| Build does not require a reachable database (CI builds with a dummy `DATABASE_URL`) | CODE_VERIFIED |
| `postgres({ max: 1 })` pooling suitability for serverless concurrency | REQUIRES_LIVE_VERIFICATION |
| Cron function duration under the plan's execution limit with real API latency | REQUIRES_LIVE_VERIFICATION |
| Neon connectivity, migration application, live smoke tests | REQUIRES_LIVE_VERIFICATION |

Nothing found is INCOMPATIBLE.

---

## 19. Adversarial scenarios (Phase 20)

| Scenario | Current behaviour |
| --- | --- |
| AI says a paid course is free | Blocked **only if** the text carries paid signals. If the text is ambiguous, AI wins — P1-01. |
| Search result contains prompt injection | Contained: fixed system prompt, delimiters stripped, structured output enforced, and the classifier is text-pattern based (`free-status.test.ts:25-29`). |
| Two URLs point to the same course | Normalization catches tracking-parameter variants; genuinely different paths for the same course are only caught by the untriggered soft-duplicate helper. |
| Coupon expired yesterday | `classifyFreeStatusFromText` maps "coupon expired" + price to `PAID`, and `decideExpiration` moves the course to `EXPIRED`. Correct. |
| Admin double-clicks approve | Button disables client-side; server-side the second transaction fails on the slug unique index. No double publish. |
| Cron executes concurrently | No lock; duplicated spend but no corrupt state. |
| Course becomes paid after publication | Handled by the verify cron — **provided** the evidence is conclusive; otherwise P1-02 hides the failure. |
| Provider redirects to another domain | Out of our control after the 302; we validate only our own stored destination. Consistent with §24 ("always redirect to the provider"). |
| Certificate status undeterminable | Correctly `UNKNOWN` deterministically — but AI can overwrite it (P1-01). |
| Course metadata contains HTML/script | Never rendered as HTML; React escapes it. `sanitizeExternalContent` deliberately does not strip tags because the value is only sent to the model, never to the DOM. |

---

## 20. Remediation decision

Fixed in M18.1:

- **P0-01** — production seed guard.
- **P1-01** — deterministic rejection now outranks AI for both price and certificate.
- **P1-02** — verification only refreshes `last_verified_at` on conclusive evidence.
- **P1-04** — discovery topic/provider parameters are honoured end to end.
- **P1-05** — route-handler tests for admin authz, cron authz and outbound redirect.
- **P1-06** — re-publishing no longer resets `last_verified_at`.
- **P2-01** — duplicate marking now persists outside the rolled-back transaction.
- **P2-02** — `NULLS LAST` plus deterministic tiebreakers on all catalog sorts.
- **P2-04** — search now covers category names.
- **P2-05** — recommendation label rendered on the course card.
- **P3-03** — performance indexes declared in the Drizzle schema.

Deferred with rationale:

- **P1-03** (manual add pipeline) — requires new endpoints and a preview flow; that is feature
  work, not audit remediation. Documented as the top item for the next milestone.
- **P2-03** (deterministic ranking on catalog pages) — needs a persisted ranking score or a
  domain-layer sort over a bounded window; a design decision, not a local fix. Partially
  mitigated by P2-02.
- **P2-06** (edit + approve UI), **P2-07** (course detail sections + schema columns),
  **P3-01**, **P3-02** — product/UI scope for a later milestone.
- Remaining P3s — recorded, not acted on.

---

## 21. Second independent pass (Phase 23)

Re-read §12, §13, §20, §29, §36, §44, §58 and Rules 3/7/9, then re-traced the eight critical
paths against the *post-remediation* code without assuming the fixes were correct.

| Path | Result |
| --- | --- |
| AI boundary | `resolvePriceType` / `resolveCertificateType` now split "refusal" from "gap": AI is rejected whenever the deterministic pass matched signals, and the rejection is written into the evidence rationale so a reviewer can see it happened. Confirmed the conflicting-signal branch (`free-status.ts:204-211`) is reachable and also protected. |
| Approval | Publication still has exactly one path (`approveCandidate`) behind ADMIN. The duplicate branch now marks the candidate outside the rolled-back transaction. Residual: if that follow-up write itself fails, its error replaces `DuplicateCourseError` — the candidate stays reviewable, so the failure mode is safe. |
| Course publication | `status: "PUBLISHED"` is written in exactly three places (approve, admin create, admin status change); all three are behind authentication plus a role check. |
| Free classification | Re-checked every caller of `classifyFreeStatusFromText`. No caller reads `priceType` without going through `resolvePriceType`. |
| Verification | Found and fixed **P1-06**. Also confirmed `persistVerification` writes `lastVerifiedAt` only under `result.refreshLastVerifiedAt`, and that an inconclusive recheck is stored as a `FAILED` verification row, which is what feeds `computeRecheckPriority`. Remaining nit (not a defect): `trustState` is still computed with `verificationSucceeded: true` even on an inconclusive result, but it is never persisted, so nothing consumes it. |
| Admin authorization | Now executed by tests, not just read: 11 route-level cases covering anonymous, wrong-role and forged-cookie requests. Verified the database is never reached on a rejected request. |
| Cron | Fails closed with no secret, wrong secret, and — newly asserted — returns 503 without touching the database when the search provider is unconfigured. |
| Outbound redirect | Re-validated `assertSafeHttpUrl` immediately before the 302; unsafe stored URLs fall back to the course page; analytics failure never blocks the learner. |

Remaining contradictions between plan and implementation after remediation are P1-03, P2-03,
P2-06, P2-07 and the P3 list — all documented above, none of them silent.

---

## 22. Quality gates after remediation

| Gate | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS — 30 files / 159 cases (was 27 / 126) |
| `npm run build` | PASS — 21 routes compiled, no build-time database dependency |
