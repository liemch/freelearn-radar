# FreeLearn Radar — v1.3 + v1.3.1 Final Validation

## Executive Summary

**Final verdict: READY_FOR_HUMAN_REVIEW**

Two independent review passes were run against `project-plan-v1_3.md` (M20.0–M20.14)
and `project-plan-v1.3.1.md` (M21.0–M21.12). No prior report was accepted as
evidence; every claim was traced to code, schema, runtime call path and test.

The dominant finding class was **false completion**: capabilities that existed as
well-tested libraries with no production caller. Coupon discovery had no cron
schedule. The media pipeline had no writer. Hybrid search computed fused results
the page then discarded. Three feature flags gated nothing. Each of these would
have read as "shipped but switched off" while there was nothing behind the
switch.

One P0 was found and fixed: `/go/affiliate` was an exploitable open redirect via
an unvalidated `locale` query parameter, reachable anonymously and reachable even
with monetization disabled.

Two of the three P1s found in PASS 2 were defects in PASS 1's own remediation —
the hybrid hydration fix broke pagination, and the coupon expiry fix was
readmitted through a fallback branch one function later. That is the result the
two-pass structure exists to produce.

**P0 = 0 and P1 = 0 remaining.** Two items are recorded as accepted risk and one
as a genuine blocker: the semantic relevance floor cannot be calibrated without
human relevance labelling, so semantic and hybrid retrieval remain off by
construction, and the §91 STOP 1 benchmark gate remains unevaluated.

Nothing was committed, pushed or deployed. All changes are in the working tree.

## Versions Reviewed

- **v1.3.0** — M20.0 through M20.14 (search relevance, semantic/hybrid retrieval,
  decision features, monetization foundation, Vietnamese-only direction)
- **v1.3.1** — M21.0 through M21.12 (coupon discovery, multi-domain coverage,
  course media, discovery UX)

Architectural deviation accepted, not treated as a defect: the repository is a
single Next.js application, not the `apps/web` + `apps/monitor` monorepo the v1.3
plan assumes. Background work runs as Vercel cron routes. The plan explicitly
requires adapting names and structures to the real repository.

---

## PASS 1

P0 found: **1**
P1 found: **10**
P2 found: **11**
P3 found: **7**

Fixed: P0-1; all ten P1s (P1-10 partially, by decision); P2-1 through P2-10;
P3-1 and P3-6.
Deferred: P2-11 and five P3 items, documented with reasoning.
Blocked: none at PASS 1.

Full inventory with evidence: `docs/V1_3_V1_3_1_REVIEW_PASS1.md`.

| ID | Severity | Finding |
|---|---|---|
| P0-1 | P0 | `/go/affiliate` open redirect via unvalidated `locale` query parameter |
| P1-1 | P1 | Expired coupons still surfaced as active 100% deals |
| P1-2 | P1 | Verification could promote an already-expired offer |
| P1-3 | P1 | Unverified `FREE_WITH_COUPON` wore the verified "Coupon 100%" badge |
| P1-4 | P1 | PAID/FREE_TRIAL/FREE_PREVIEW leaked into Course Detail related courses on the default path |
| P1-5 | P1 | Image fetch SSRF defenses materially weaker than the HTML fetch path |
| P1-6 | P1 | M21.6 media pipeline had no production caller |
| P1-7 | P1 | Coupon discovery/verification never scheduled |
| P1-8 | P1 | Hybrid/semantic results never reached the rendered search page |
| P1-9 | P1 | Balanced multi-domain discovery budget not applied at runtime |
| P1-10 | P1 | `FEATURE_NL_COURSE_FINDER` and `FEATURE_CROSS_LANGUAGE` gated nothing; NL quota not durable |
| P2-1 | P2 | JSON-LD injectable via unescaped `</script>` |
| P2-2 | P2 | Sitemap and hreflang still published English URLs |
| P2-3 | P2 | `assertSafeHttpUrl` did not block credentials in URL |
| P2-4 | P2 | `coupon_candidates.offer_url` had no UNIQUE constraint |
| P2-5 | P2 | `scripts/neon-bootstrap.sql` stale by a whole migration |
| P2-6 | P2 | Query embedding cache TTL never enforced |
| P2-7 | P2 | `/mien-phi-hom-nay` absent from the sitemap |
| P2-8 | P2 | Hybrid semantic-only fill skipped the eligibility check |
| P2-9 | P2 | Coverage admin blind to never-run categories; verified/published always 0 |
| P2-10 | P2 | `degraded` under-reported when the hybrid call threw |
| P2-11 | P2 | `unmet_intent` conflates zero results with no-result-above-floor (documented) |

---

## PASS 2

P0 found: **0**
P1 found: **3**
P2 found: **4**
P3 found: **1**

Fixed: PASS2-1, PASS2-2, PASS2-4, PASS2-5.
Deferred: PASS2-6, PASS2-7, PASS2-8, PASS2-3 — documented with reasoning.
Blocked: relevance floor calibration.

Full detail: `docs/V1_3_V1_3_1_REVIEW_PASS2.md`.

| ID | Severity | Origin | Finding |
|---|---|---|---|
| PASS2-1 | P1 | **PASS 1 regression** | Hybrid pagination served page 1's results under every page number |
| PASS2-2 | P1 | Pre-existing, missed | Semantic retrieval had no similarity floor; weak matches suppressed the honest empty state |
| PASS2-5 | P1 | **PASS 1 incomplete** | Expired-coupon course readmitted through the daily-free fallback |
| PASS2-4 | P2 | **PASS 1 regression** | Media batch limit counted joined rows, not courses |
| PASS2-6 | P2 | Pre-existing | `withDb` renders DB failure as absence of data |
| PASS2-7 | P2 | Pre-existing | Outbound click endpoints not rate limited |
| PASS2-8 | P2 | Pre-existing | Embedding daily token budget is per-run, not per-day |
| PASS2-3 | P3 | Naming | `relevanceFloor` config is a rank cutoff, not a relevance floor |

---

## Final Remaining Findings

**P0: 0. P1: 0.**

Remaining P2:

1. **PASS2-6 — `withDb` masks database failure as empty data.** A DB outage
   renders "no results" / "no deals today" rather than an error state. Logged,
   so observable, but the page makes a confident false claim. Fixing it means
   changing the contract at ~40 call sites and adding error states to every
   surface — a broad refactor with real regression risk, and not a v1.3/v1.3.1
   requirement. Recommended as a scoped follow-up.
2. **PASS2-7 — outbound click endpoints unrate-limited.** Inflates the North Star
   metric and allows unbounded writes. Tracking failure already never blocks the
   redirect, so this is analytics integrity, not availability. The existing
   limiter is per-instance in-memory and would give weak coverage.
3. **PASS2-8 — embedding daily token budget is per-run.** Bounded in practice by
   once-daily cron plus the durable query cache. `EMBEDDING_DAILY_BUDGET_USD`
   from §104 does not exist.
4. **P2-11 — `unmet_intent` conflation.** On the lexical path it defaults to
   `zeroResult`, whereas §89.6 defines it as "no result above floor". Left
   deliberately: with no floor applied, treating zero results as unmet intent is
   the conservative reading and preserves the catalog-gap signal.

Remaining P3:

5. **PASS2-3** — `relevanceFloor` naming, documented in place; the value is
   persisted in `search_benchmark_runs` so renaming would invalidate run history.
6. **P3-2** — several §104 env vars live in versioned config rather than env
   (`SIMILAR_MAX_PER_PROVIDER`, `LEARNING_PATH_MIN/MAX_STEPS`,
   `SEARCH_*_VERSION`, `SEARCH_P95_BUDGET_MS`, `NL_INTENT_CACHE_TTL_DAYS`).
   Arguably better than env for versioned values; noted as a plan deviation.
   `RELEVANCE_FLOOR` was added during this run.
7. **P3-3** — taxonomy has two sources of truth: `M21_TAXONOMY_CATEGORIES` plus
   `buildExpandedCategorySeeds` (both dead) versus `SEED_CATEGORIES` (live).
   `resolveCategoryAlias` and `CATEGORY_ALIAS_DICTIONARY` are also unreferenced.
   Left in place: deleting them is safe but unrelated to any finding, and
   §116.13 forbids big-bang cleanup.
8. **P3-4** — `classifyAccessFromText` is test-only and `free-status.ts` never
   emits `FREE_PREVIEW`, so that enum value is unreachable from classification.
   Preview signals correctly resolve to `UNKNOWN` rather than to a free status,
   so no invariant is violated; the M21.5 classifier is simply not the runtime
   path.
9. **P3-5** — `logger` performs no secret redaction. No call site was found
   passing a secret, but the guard does not exist.
10. **P3-7** — RBAC asymmetry: single candidate approve requires ADMIN, bulk
    approve accepts EDITOR.

## Accepted Risks

1. **Coupon verification evidence is HTML-heuristic, not checkout truth.**
   `evidenceFromOfficialFetch` derives 100%-off from regexes over the provider
   page. It correctly refuses to promote without a successful official fetch, and
   an aggregator claim alone can never reach `ACTIVE_100_OFF`. But a provider page
   containing "100% off" for an unrelated reason could produce a false positive.
   Accepted because the alternative — driving checkout — would breach the Provider
   Policy that §120 makes law.
2. **Semantic/hybrid retrieval is off by construction** until the relevance floor
   is calibrated. This is a deliberate consequence of the PASS2-2 fix rather than
   a gap: enabling it without a floor would ship weak matches and erase the
   catalog-gap signal.
3. **NL intent quota is process-memory.** Per-IP and global caps reset on cold
   start. It only ever fails open toward the deterministic parser, and there is no
   AI call behind it to protect, so cost exposure is currently nil.

## Quality Gates

Commands are the actual scripts in `package.json`. There is no separate
integration-test, benchmark or security-test script; `npm run test` is the whole
Vitest suite and includes the security, coupon, media and Vietnamese-UI
regression files.

| Command | Result | Notes |
|---|---|---|
| `npm run lint` | **PASS** | 0 errors, 1 pre-existing warning (`no-page-custom-font` in `layout.tsx`, unrelated) |
| `npm run typecheck` | **PASS** | `tsc --noEmit`, clean |
| `npm run test` | **PASS** | 70 files, 599 tests |
| `npm run build` | **PASS** | Compiled; 70/70 static pages generated |
| `npm run db:bootstrap:generate` | **PASS** | Regenerated from 14 journal migrations |
| Migration validation | **PARTIAL** | Journal/schema/ORM consistency verified statically; SQL not executed — no database available locally |
| `npm run search:benchmark` | **NOT RUN** | Requires a populated database; and the dataset has no graded labels, so NDCG/P@5 would be null regardless |
| Security regression | **PASS** | `src/test/security.test.ts`, `route-security.test.ts`, `m20-hardening.test.ts`, `m21-hardening.test.ts`, `v13-review-regression.test.ts` |
| Coupon regression | **PASS** | `coupon-service.test.ts`, `offer-url.test.ts`, `coupon-verification-runner.test.ts`, `v13-wiring-regression.test.ts` |
| Media regression | **PASS** | `m18-2-images.test.ts`, `media-resolver.test.ts`, `v13-pass2-regression.test.ts` |
| Vietnamese UI regression | **PASS** | `m18-2-i18n.test.ts`, `m18-3-i18n-routing.test.ts`, `m18-4-translation-completeness.test.ts` |

Gates were run at three points: baseline, after PASS 1 remediation, and after
PASS 2 remediation. All three were green; no gate was ever bypassed, skipped or
weakened.

## Tests

Tests before: **508** across 67 files.
Tests after: **599** across 70 files.
Net new: **+91**.

New regression tests, all named after the finding they lock down:

- `src/test/v13-review-regression.test.ts` — PASS 1 findings: hostile-locale
  table for the open redirect, five coupon-expiry status cases, related-course
  eligibility, discovery interleaving, JSON-LD escaping round-trip, userinfo
  rejection, NL intent narrowing.
- `src/test/v13-wiring-regression.test.ts` — runtime wiring, the class of defect
  unit tests cannot catch: every cron route has a schedule, the media resolver has
  a production caller and persists its columns, the search page hydrates fused
  ids, SEO is Vietnamese-only, expired offers leave the daily-free surface through
  both branches, only a verified offer may claim the coupon badge.
- `src/test/v13-pass2-regression.test.ts` — PASS 2 findings: hybrid page slicing,
  relevance-floor calibration states, the RRF floor arithmetic as executable
  assertions, media batch-size semantics.
- `src/test/m18-2-images.test.ts` — extended with a 15-case hostile URL table and
  three redirect scenarios (private-host hop rejected before request, redirect
  loop, safe redirect followed) plus a declared-content-length case.
- `src/test/m18-3-i18n-routing.test.ts` — two hreflang tests updated to the
  M20.14 Vietnamese-only requirement.

Two existing tests were changed, both because the requirement changed rather than
to make a failure go away:

- `hreflang alternates cover en, vi, and x-default` asserted behaviour §116.8
  forbids. Replaced with two tests asserting Vietnamese-only, including the
  `/en` route case.
- `blocks redirect to private host` mocked `redirect: "follow"` semantics that no
  longer exist. Rewritten to model a real 302 and to additionally assert the
  private hop is never requested — a strictly stronger assertion.

No test was deleted, skipped, or weakened. No assertion was relaxed.

## Search Evaluation

**Not measured.** Values are omitted rather than estimated.

The dataset at `data/search-eval/v1/queries.json` holds 62 queries — above the
§86.4 minimum of 60 — with correct group and locale coverage:

| Dimension | Distribution |
|---|---|
| Groups | EXACT 6, KEYWORD 26, NL 12, CONSTRAINT 6, CROSS_LANG 6, NEGATIVE 6 |
| Locales | EN 29, VI 22, VI_NO_DIACRITIC 11 |
| **Graded relevance labels** | **0 of 62** |

- NDCG@10: not measurable — no graded labels
- Precision@5: not measurable — no graded labels
- Exact-title success: not measured — requires a populated database
- VI / VI-unaccent / VI→international: not measured — same reason
- Fallback rate: not measured — requires production traffic

§86.4 requires graded relevance 0–3 from two independent annotators with recorded
inter-annotator agreement. That is human work this run may not fabricate. The
structural consequence is that **§91 STOP 1 has not been passed**: the four-way
LEXICAL BASELINE / LEXICAL UPGRADED / SEMANTIC / HYBRID comparison and the
+15% NDCG@10 gate cannot be evaluated, so per §91 the honest state is that v1.3
stands at M20.4 for retrieval quality purposes.

## Coupon Validation

| Aspect | Status |
|---|---|
| Parser | PASS — `parseCourseOfferUrl` fixtures, including the known-positive Udemy shape from §122.2 |
| couponCode preservation | PASS — coupon params stripped only for `canonical_url`; `normalizeUrl` removes tracking only |
| canonical/offer separation | PASS — same canonical, distinct offer per coupon code |
| 100%-verification | PASS — aggregator claim yields `DISCOVERED`; only a successful official fetch can promote; blocked/failed fetch yields `BLOCKED`/`UNKNOWN` |
| Expiry | **FIXED** — now enforced at write (recorded expiry outranks page text) and at read (SQL filter plus domain guard); expired courses no longer readmitted via the fallback |
| Re-verification | PASS — bounded priority queue with per-status backoff, now actually scheduled |
| Duplicate handling | **FIXED** — DB unique index on `coupon_candidates.offer_url` plus conflict-tolerant insert; multiple codes for one course remain distinct offers |
| Live verification | NOT RUN — requires hitting Udemy |

## Course Media

| Aspect | Status |
|---|---|
| Image resolution | **FIXED** — `runMediaResolution` now called from the cron behind `FEATURE_MEDIA_RESOLVER`; persists all `image_*` columns |
| Broken image handling | PASS — client-side fallback; a broken image never breaks the card and never removes the course |
| Fallback | PASS — deterministic branded provider/category tile, explicitly not presented as official artwork; no AI-generated or third-party images |
| SSRF regression | **FIXED** — shares `validateSafeFetchUrl` with the HTML path; manual per-hop redirect validation, 3-hop cap, content-type allowlist, size bound, timeout. 15-case hostile URL table |
| Coverage | NOT MEASURED — no database locally. Approval now seeds a truthful `PENDING`/`MISSING` state so the metric becomes real once the cron runs |

Known fidelity limit: content is not sniffed, so a response with an `image/png`
header and an HTML body is accepted as bytes and fails to render, falling back
client-side. Bounded, not a security issue.

## Multi-Domain Discovery

| Aspect | Status |
|---|---|
| Category coverage | All 13 required Vietnamese top-level domains defined and seeded (Tech as six leaf categories rather than an umbrella row, by design) |
| Starvation findings | **CONFIRMED and FIXED.** `DISCOVERY_BUDGET_CATEGORY_SLUGS` was test-only; selection was a global FIFO, so each category's share of a run tracked its share of seeded queries — 38 of 89 queries (~43%) in three Tech categories, while `design` had 0 and five domains had 1 |
| Discovery configuration | **FIXED** — `interleaveByCategory` caps any category's share of a run at `1/categoryCount`; seeds added for `design` (2, VI+EN) and for `finance`, `career`, `lifestyle-health`, `education`, `science-engineering`, `humanities` |
| Observability | **FIXED** — coverage admin unions the seeded taxonomy so never-run categories appear and count as starved; `verified`/`published` now bumped at approval |

No hard quota was imposed and no course-count parity is required, per §124.2.

## Coursera Access Classification

| Access type | Status |
|---|---|
| FREE_FULL | Present in the `price_type` enum; free-list eligible |
| FREE_AUDIT | Present and distinct. "Enroll for free" maps to `FREE_AUDIT`, **not** `FREE_FULL` — verified in `free-status.ts` |
| FREE_PREVIEW | Present in the enum and excluded from free lists. Preview-only signals resolve to `UNKNOWN` rather than any free status |
| FREE_TRIAL | Excluded from every free-labelled surface, including an explicit `?price=FREE_TRIAL` filter |
| PAID | Excluded; now also excluded from related/similar courses, which was the P1-4 leak |
| Certificate separation | PASS — `courses.certificate_type` is an independent column with its own resolver and authority order |

Gap, P3-4: the M21.5 `classifyAccessFromText` is test-only; runtime uses
`classifyFreeStatusFromText`, which never emits `FREE_PREVIEW`. No invariant is
violated because preview signals fail closed to `UNKNOWN`, but the M21.5
classifier is not the runtime path.

## Security Review

| Surface | Result |
|---|---|
| RBAC | PASS with one asymmetry (P3-7). Middleware requires a session for all `/admin/*` and `/api/admin/*`; every mutating admin API enforces a role via `assertAdmin`/`assertEditor`/explicit check |
| IDOR | PASS — admin scope is global by design; watch confirm uses a hashed token, unsubscribe uses an HMAC with timing-safe compare, watch creation returns an opaque result to prevent enumeration |
| CSRF | PASS — `SameSite=Lax`, `httpOnly`, `secure` session cookie; cross-site POST/PATCH to admin APIs carries no cookie |
| XSS | **FIXED** — JSON-LD now escapes `<`, `>`, `&`, U+2028/9. The only other `dangerouslySetInnerHTML` serialises a locale literal |
| SQL injection | PASS — lexical query text is passed as bound Drizzle parameters; no `to_tsquery` construction from user input, no string concatenation |
| SSRF | **FIXED** — image path unified onto `validateSafeFetchUrl` with per-hop redirect validation. No public endpoint fetches an arbitrary URL; `url-shape` classifies by regex without fetching, `ai/diagnose` uses a fixed sample |
| Open redirect | **FIXED (P0)** — `/go/affiliate` locale parameter now validated. Every other redirect target is either a validated locale or a DB-sourced URL through `assertSafeHttpUrl` |
| Prompt injection | N/A in practice — no AI call takes user query text. `parseIntentWithOptionalAi` returns the deterministic parse; user text is never sent to a model |
| Rate limiting | PARTIAL — admin login and watch creation only, in-memory. Outbound click endpoints unprotected (PASS2-7) |
| Secrets | PASS — no `NEXT_PUBLIC_` leakage, no key values in responses or logs; production boot requires `AUTH_SECRET` ≥ 32 and `CRON_SECRET` ≥ 16. Logger lacks a redaction guard (P3-5) |
| Embedding/AI proxy | PASS — no public endpoint accepts free text and returns a vector; asserted by test |
| Cost amplification | PASS for AI (no AI path) and embeddings (durable cache, bounded batch); see PASS2-8 for the daily budget |

## Database / Migration Review

**Summary.** Migrations 0000–0013 with a correctly ordered journal. Migrations
0007–0012 were checked column by column against `src/db/schema/*.ts` for name,
type, nullability and default: **no ORM/schema drift found in either direction**.
All are additive — no `DROP`, no type narrowing, no `NOT NULL` without default —
so all are safe on non-empty production tables. Extensions (`unaccent`,
`pg_trgm`, `vector`) are created `IF NOT EXISTS`, and `immutable_unaccent` is
correctly declared `IMMUTABLE` so the trigram indexes are valid. Every
TypeScript enum value has a matching Postgres enum value, including
`FREE_PREVIEW` added via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

**Findings.**

- `coupon_candidates.offer_url` had no UNIQUE constraint while
  `course_offers.offer_url` did; duplicate suppression was a read-then-insert
  race (P2-4).
- `scripts/neon-bootstrap.sql` was stale by all of migration 0012 — a manual
  Neon bootstrap produced a database with no coupon, media or taxonomy objects
  (P2-5).
- No pgvector ANN index. **Correct per §88.5**, which forbids one at this catalog
  scale and sets `> 20 000 course` or `vector p95 > 250ms` as the reopen
  threshold.
- No index on `coupon_candidates.offer_url` despite a lookup per discovered
  candidate.

**Corrections.** Migration `0013_v13_review_remediation.sql` de-duplicates
existing candidate rows (keeping the earliest per `offer_url`) and adds the unique
index, which also serves the lookup. Journal entry added; Drizzle schema updated
to match; the insert is now `onConflictDoNothing`. Bootstrap SQL regenerated from
all 14 migrations.

The migration follows repo convention: no `--> statement-breakpoint`, matching
0012, consistent with `migrate.ts` deliberately using the TCP driver because
"Neon HTTP cannot run multi-statement SQL files".

**Not run:** the SQL was not executed — no database is available locally, and
§3 forbids requiring production credentials to finish a local review.

## Runtime Wiring Review

Disconnected or dead implementations found:

1. **Coupon discovery + verification** — route existed, no cron schedule. Nothing
   could ever create an `ACTIVE_100_OFF` row in production, which also meant the
   daily-free surface permanently served its fallback branch.
2. **Media pipeline (M21.6)** — resolver, schema columns, admin read and tests all
   existed; no writer, and `FEATURE_MEDIA_RESOLVER` appeared only in its own
   schema declaration.
3. **Hybrid search (M20.3)** — fused ids were computed then used only to reorder
   the 12-row lexical page, so semantic rescue for zero-lexical queries produced
   an empty page.
4. **`FEATURE_NL_COURSE_FINDER`** — no runtime reader; `parseIntentWithOptionalAi`
   was called only from tests.
5. **`FEATURE_CROSS_LANGUAGE`** — declared in `env.ts`, read nowhere.
6. **`DISCOVERY_BUDGET_CATEGORY_SLUGS`** — asserted by a test, never read by the
   scheduler.
7. **`QUERY_EMBEDDING_CACHE_TTL_DAYS`** — validated, never read.
8. **`discovery_category_stats.verified_count` / `published_count`** — columns
   written by nothing; admin always showed 0.
9. **`classifyAccessFromText`** (M21.5) — test-only.
10. **Dead taxonomy helpers** — `buildExpandedCategorySeeds`,
    `resolveCategoryAlias`, `CATEGORY_ALIAS_DICTIONARY`.

Corrections: 1–4 and 6–8 wired into real runtime paths. 5 and 9 recorded as NOT
DONE rather than implemented — building an AI intent parser or cross-language
retrieval logic is feature development, outside the remit of a validation run.
10 left in place per §116.13's prohibition on big-bang cleanup.

`src/test/v13-wiring-regression.test.ts` now guards this class of defect
directly, since unit tests structurally cannot.

## Files Changed During Remediation

**Security / outbound (4)**
`src/app/go/affiliate/route.ts`, `src/lib/url.ts`,
`src/services/images/course-image-service.ts`, `src/components/seo/json-ld.tsx`

**Coupon truth (5)**
`src/domain/coupon/coupon-service.ts`,
`src/domain/coupon/coupon-verification-runner.ts`,
`src/domain/coupon/coupon-discovery-runner.ts`,
`src/db/repositories/coupon-repository.ts`, `src/db/schema/coupon.ts`

**Public surface / daily free (3)**
`src/domain/discovery/daily-free.ts`,
`src/components/public/daily-free-card.tsx`,
`src/lib/i18n/dictionaries/{vi,en}.ts` + `src/lib/i18n/types.ts`

**Search relevance (5)**
`src/domain/search/hybrid.ts`, `src/domain/search/semantic.ts`,
`src/domain/search/nl-intent.ts`, `src/config/search-ranking.ts`,
`src/app/[locale]/search/page.tsx`

**Truth eligibility (2)**
`src/db/repositories/course-repository.ts`,
`src/domain/discovery/related-courses.ts`

**Media pipeline (3)**
`src/domain/media/media-resolution-runner.ts` (new),
`src/app/api/cron/coupons/route.ts`, `src/domain/candidate/approve-candidate.ts`

**Discovery coverage (3)**
`src/domain/discovery/discovery-query-service.ts`, `src/db/seed/data.ts`,
`src/app/admin/coverage/page.tsx`

**SEO / Vietnamese-only (4)**
`src/lib/i18n/seo.ts`, `src/app/sitemap.ts`, `src/app/admin/layout.tsx`,
`src/app/admin/loading.tsx`

**Embedding cache (1)**
`src/db/repositories/course-embedding-repository.ts`

**Config / schema / infra (5)**
`src/lib/env.ts`, `.env.example`, `vercel.json`,
`drizzle/0013_v13_review_remediation.sql` + `drizzle/meta/_journal.json`,
`scripts/neon-bootstrap.sql`

**Tests (5)**
`src/test/v13-review-regression.test.ts` (new),
`src/test/v13-wiring-regression.test.ts` (new),
`src/test/v13-pass2-regression.test.ts` (new),
`src/test/m18-2-images.test.ts`, `src/test/m18-3-i18n-routing.test.ts`,
`src/services/ai/nvidia-nim-provider.test.ts`

**Documentation (3)**
`docs/V1_3_V1_3_1_REVIEW_PASS1.md`, `docs/V1_3_V1_3_1_REVIEW_PASS2.md`,
`docs/V1_3_V1_3_1_FINAL_VALIDATION.md`

## Assumptions

1. **The single-app layout supersedes the plan's monorepo runtime ownership.**
   §84 assigns embedding work to `apps/monitor`; the repository has no such app
   and uses cron routes. Treated as an accepted deviation, not a defect, since
   the plan requires adapting to the real repository.
2. **The M21 cron route is the right home for media resolution.** It already has
   cron auth, a 300s `maxDuration`, and bounded-external-work semantics. Media
   resolution is placed before the coupon flag check so its own kill switch is the
   only thing gating it — image quality is independent of coupon discovery.
3. **A 6-hourly coupon cron.** §126.3 requires bounded, prioritised rechecking
   without hammering; `nextCouponRecheckAt` already sets a 6h floor for
   `ACTIVE_100_OFF`, so a 6-hourly schedule matches the existing backoff rather
   than introducing a new cadence.
4. **`FREE_WITH_COUPON` is excluded from the daily-free fallback rather than
   relabelled.** A course reaches that branch precisely because it has no verified
   offer, and nothing there distinguishes "coupon still works" from "coupon is
   gone". §126.4 removes expired coupons from the surface, so an honest empty
   state is correct where a populated one would not be.
5. **`RELEVANCE_FLOOR` has no default, and an unset value disables semantic
   retrieval.** §89.5 requires the floor to come from labelled data; defaulting a
   number would fabricate a gate, and leaving it absent would ship weak matches.
   Failing closed satisfies both constraints.
6. **English routes keep serving.** §117 rules 7–8 forbid removing indexed locale
   routes before an SEO migration, so only the sitemap and hreflang stopped
   advertising them. The `/en/*` routes still render.
7. **Intent-derived filters only narrow.** An explicit UI filter always wins, and
   an inferred English-language hint is deliberately ignored so a Vietnamese query
   still retrieves international courses (§116.6).
8. **Test changes reflect changed requirements, never convenience.** The two
   modified assertions are justified individually in the Tests section above.

## Manual / Live Verification Still Required

1. **Relevance floor calibration — blocking for semantic/hybrid.** Produce graded
   relevance labels (0–3) for the 62-query dataset with two independent
   annotators, record inter-annotator agreement per §86.4, derive the cosine
   threshold from the score distribution of label-0 versus label-≥2 pairs, and set
   `RELEVANCE_FLOOR`. Until then semantic and hybrid retrieval stay off by
   construction.
2. **§91 STOP 1 four-way benchmark.** Requires (1) and a populated database.
   `npm run search:benchmark` exists and runs from one command.
3. **§80.2 Precondition Check and §86.3 Intent Diagnosis** need production
   analytics: outbound CTR, sessions, returning-visitor share, search usage share,
   zero-result rate, and the CATALOG_GAP classification that Gate B depends on.
4. **Migration 0013 against a real database.** Verified statically only.
5. **Live coupon verification against Udemy** — the HTML-evidence heuristics are
   the one coupon path fixtures cannot cover.
6. **Media coverage baseline** — run the media cron against the real catalog to
   populate `image_*` and confirm the §128.5 metrics.
7. **Real USD embedding cost** (§88.7, §98.1) — needs provider invoice data.
8. **Mobile/visual QA** of the daily-free and search surfaces — reviewed as code,
   not rendered on a device.
9. **SEO migration monitoring** — confirm no mass 404s and that Vietnamese
   canonicals are honoured after the sitemap change.

## Final Verdict

**READY_FOR_HUMAN_REVIEW**

Acceptance criteria met: both audits complete, both finding inventories written,
remediation complete, final gates green (lint, typecheck, 599 tests, build), final
diff reviewed for artifacts, final plan→code trace complete. **P0 = 0, P1 = 0.**

Two qualifications a reviewer should read before deciding to deploy:

- **v1.3 has not passed §91 STOP 1.** Retrieval quality is unmeasured because the
  evaluation dataset has no labels. Per the plan's own rule that "a gate without a
  number is not a gate", v1.3 stands at M20.4 for retrieval purposes, and the
  semantic and hybrid flags must stay off until calibration is done.
- **v1.3.1's coupon and media pipelines have never executed.** They were
  unreachable in production before this run — unscheduled and uncalled
  respectively. They are now wired and covered by tests, but every run so far has
  been synthetic. First real execution should be watched, with the flags enabled
  one at a time per §140.

Nothing was committed, pushed or deployed. All changes remain in the working tree
for review.
