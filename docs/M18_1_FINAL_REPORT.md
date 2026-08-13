# M18.1 — Final Report

Independent conformance audit of FreeLearn Radar against `project-plan.md`, plus the
remediation carried out inside the audit's scope.

Full evidence: [`docs/M18_1_CONFORMANCE_AUDIT.md`](./M18_1_CONFORMANCE_AUDIT.md).

No commit, push or deployment was performed. M19 was not started.

---

## 1. Project plan conformance scorecard

| WP | Verdict |
| --- | --- |
| WP0 — Foundation | IMPLEMENTED_CORRECTLY |
| WP1 — Database & schema | IMPLEMENTED_WITH_GAPS |
| WP2 — Admin auth | IMPLEMENTED_CORRECTLY *(was IMPLEMENTED_WITH_GAPS; the missing authorization tests were the only gap and are now in place)* |
| WP3 — Public catalog | IMPLEMENTED_WITH_GAPS |
| WP4 — Admin course management | IMPLEMENTED_WITH_GAPS |
| WP5 — Search provider | IMPLEMENTED_CORRECTLY |
| WP6 — Discovery engine | IMPLEMENTED_CORRECTLY *(after the P1-04 fix)* |
| WP7 — NVIDIA AI integration | IMPLEMENTED_CORRECTLY *(after the P1-01 fix)* |
| WP8 — Candidate review | IMPLEMENTED_WITH_GAPS |
| WP9 — Ranking | IMPLEMENTED_WITH_GAPS |
| WP10 — Cron discovery | IMPLEMENTED_CORRECTLY |
| WP11 — Outbound tracking | IMPLEMENTED_CORRECTLY |
| WP12 — SEO | IMPLEMENTED_CORRECTLY |
| WP13 — Reliability & security | IMPLEMENTED_CORRECTLY *(after the P1-05 tests)* |
| WP14 — Production readiness | CANNOT_VERIFY_WITHOUT_LIVE_ENVIRONMENT |

Residual gaps by WP: WP1 — unused columns; WP3 — P2-03, P2-05 sibling items, P2-07, P3-01;
WP4 — P1-03 manual add pipeline, P3-02, P3-09; WP8 — P2-06 edit-and-approve UI;
WP9 — P2-03 catalog ranking.

### Requirements matrix

Scope: 96 discrete, checkable requirements extracted from §1–§64, WP0–WP14, AI Coding Rules
1–10 and Master Instructions 1–17.

| Classification | Before remediation | After remediation |
| --- | --- | --- |
| PASS | 71 | 81 |
| PARTIAL | 13 | 7 |
| MISSING | 5 | 3 |
| INCORRECT | 4 | 0 |
| UNVERIFIED (needs live infrastructure) | 3 | 3 |
| OUT_OF_SCOPE (plan's own non-goals) | 0 | 0 |

The four INCORRECT items were P0-01, P1-01, P1-02 and P1-06 — cases where the code did
something the plan forbids rather than merely omitting something. All four are fixed.

---

## 2. Findings

| Severity | Found | Fixed | Deferred |
| --- | --- | --- | --- |
| P0 | 1 | 1 | 0 |
| P1 | 6 | 5 | 1 (P1-03) |
| P2 | 7 | 4 | 3 |
| P3 | 9 | 1 | 8 |

**P0 — fixed**

- **P0-01** Production seed published 8 fabricated courses stamped as verified. Sample courses
  now require an explicit local opt-in and are refused outright on any production runtime;
  provider/category/query/admin seeding is untouched, as WP14 requires. Both operator documents
  were corrected.

**P1 — 5 of 6 fixed**

- **P1-01** AI could overturn the deterministic classifier's explicit "not enough evidence"
  verdict and turn ambiguous marketing copy into a "100% Free" badge. Deterministic refusals now
  win for both price and certificate; AI may still fill a genuine evidence gap at capped
  confidence.
- **P1-02** Verification refreshed `last_verified_at` and recorded `VERIFIED` even when the
  evidence carried no pricing signal. A recheck is now conclusive only on a usable price
  classification or a definitive unavailability signal; otherwise it is stored as `FAILED` and
  the previous timestamp stands.
- **P1-04** `/admin/discovery` had no topic/provider controls and the API silently discarded the
  parameters it validated. Both are now honoured end to end and the selectors exist.
- **P1-05** No test executed any route handler. Admin authorization, cron authentication and
  the failure-closed behaviour of the cron routes are now covered.
- **P1-06** *(found in the second pass)* Re-publishing a course reset its verification clock.
  The timestamp is now stamped only on first publication.
- **P1-03 deferred** The §30 manual add pipeline (paste URL → fetch → extract → AI → preview →
  confirm) does not exist; `/admin/courses/new` is a plain data-entry form. Building it is
  feature work, which this audit was instructed not to do. It is the top item for the next
  milestone, and the plan calls it "cực kỳ quan trọng" as the automation-failure fallback.

**P2 — 4 of 7 fixed**

Fixed: duplicate-approval marking now survives its own transaction rollback (P2-01); catalog
sorts use `NULLS LAST` with deterministic tiebreakers so unscored courses no longer outrank
scored ones (P2-02); search covers category names per §26 (P2-04); the `⭐ Recommended` label
from §19/§23 is rendered (P2-05).

Deferred: catalog "Recommended" still sorts on raw `quality_score` rather than the §20
composite (P2-03 — needs a persisted ranking score, a design decision); edit-and-approve UI
(P2-06); the four missing course-detail sections, which are a schema gap as well as a UI gap
(P2-07).

**P3 — 1 of 9 fixed**

Fixed: the seven performance indexes are now declared in the Drizzle schema, so a future
`drizzle-kit generate` will not propose dropping them (P3-03). The other eight are recorded
with evidence and left alone deliberately.

---

## 3. Drift assessment

| Dimension | Verdict |
| --- | --- |
| Architecture drift | **None.** Provider abstractions, the repository layer and the candidate/course lifecycle separation all hold. No direct Tavily or NVIDIA `fetch` exists outside `src/services/`. |
| Business logic drift | **One, now corrected.** M16's documented "AI fills gaps" rule was implemented so that it also overrode deterministic *rejections* (P1-01). The design document does not authorise that, so it was a defect, not an intentional supersession. |
| Security drift | **None.** M15 hardening is intact; the gap was in test coverage, not controls. |
| Scope creep | **Minor and benign.** `/provider/[slug]`, `/free-courses/[topic]`, `/free-certificate-courses` and `/collections/[slug]` are additions; all are SEO-aligned with §41/§42 and none conflicts with the MVP. |
| Over-engineering | **Low.** The verification engine is justified by §44. Unused barrel `index.ts` files and roughly a dozen exported-but-uncalled functions are the real excess; `src/domain/provider/index.ts` is literally `export {}`. |
| Under-engineering | **The real problem area.** Missing HTTP-boundary tests (fixed), a sort column that no code ever writes (`ratingCount`), non-transactional course+category writes in admin CRUD, and a computed `trustState` that is discarded rather than persisted. |

---

## 4. Tests

| | Before | After |
| --- | --- | --- |
| Test files | 27 | 30 |
| Test cases | 126 | 159 |

The 33 added cases are regression tests for the fixed defects plus the WP13 security coverage
that was missing:

- `src/test/m18-1-conformance.test.ts` — P0-01 seeding policy, P1-01 AI-over-deterministic for
  both price and certificate, P1-02 conclusive-vs-inconclusive verification.
- `src/test/route-security.test.ts` — anonymous 401 and wrong-role 403 on four admin endpoints,
  forged session cookie, cron 401 with no secret and with a wrong secret, and fail-closed 503
  on an authenticated cron call with no search provider configured. Each also asserts the
  database is never touched on a rejected request.
- `src/db/repositories/catalog-sql.test.ts` — generates the real catalog SQL without a database
  and asserts `NULLS LAST`, the tiebreakers, the category `EXISTS` subquery and `LIKE`
  wildcard escaping.
- `approve-candidate.test.ts` — the DUPLICATE marking survives the transaction rollback.
- `discovery-engine.test.ts` — the run is scoped by provider and topic.

Each regression test targets behaviour that the pre-fix code produced differently, so all of
them would fail against the previous implementation. The route-security file is the exception
and is honest about it: those properties were already implemented correctly: the tests close a
verification gap rather than lock in a fix.

---

## 5. Quality gates

| Gate | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS — 30 files, 159 cases |
| `npm run build` | PASS — 21 routes, no build-time database dependency |

Nothing was suppressed, skipped or marked `todo`.

---

## 6. Live verification still required

| Target | Status | What must be checked |
| --- | --- | --- |
| Database (Neon) | UNVERIFIED | Connectivity, migration application, `postgres({ max: 1 })` behaviour under serverless concurrency, index effectiveness on real row counts. |
| Tavily | UNVERIFIED | No live call has ever been made from this repository. Provider behaviour is only proven against mocked HTTP. Confirm `include_domains` is honoured server-side, and confirm the result shape. |
| NVIDIA NIM | UNVERIFIED | Confirm the model honours `response_format: json_object` and that real output satisfies the Zod schema; measure latency against the AI call budget. |
| Cron | UNVERIFIED | Confirm Vercel delivers `Authorization: Bearer $CRON_SECRET`, that both daily schedules fire, and that a full discovery run completes inside the function duration limit. |
| Vercel | UNVERIFIED | Deployment, environment variables, function duration, and an end-to-end smoke test of discover → review → approve → public page → outbound redirect. |

Nothing in the code is INCOMPATIBLE with Vercel. Everything checkable statically was verified.

---

## 7. Final verdict

**CONFORMS_WITH_MINOR_GAPS**

The implementation genuinely matches the intended product: one publication path gated on human
approval, AI held to an assistive role behind Zod validation and deterministic classifiers, a
respected provider abstraction, bounded API spend, authenticated and role-checked admin and
cron surfaces, and a safe outbound redirect. The audit found one data-integrity blocker and
six serious mismatches; the blocker and five of the six are fixed, with regression tests.

The verdict is not `CONFORMS_TO_PROJECT_PLAN` for three reasons:

1. **P1-03** — the §30 manual add pipeline, which the plan calls a critical fallback, is not
   implemented. This is a whole documented product surface, and closing it is feature work.
2. **P2-03** — every catalog page other than the homepage ranks on the AI's self-reported
   quality score alone, where §20 requires a deterministic composite. The `NULLS LAST` fix
   removed the worst symptom but not the drift.
3. **WP14 is unverifiable from the repository.** Five integration surfaces have never been
   exercised against live infrastructure.

The verdict is not `REQUIRES_REMEDIATION` because no unfixed finding is a product, security or
data-integrity blocker: the remaining gaps are missing surfaces and quality shortfalls, all
documented with evidence and a recommended fix.

Before launch, in order: run the live verification list in section 6, then implement P1-03,
then decide P2-03.
