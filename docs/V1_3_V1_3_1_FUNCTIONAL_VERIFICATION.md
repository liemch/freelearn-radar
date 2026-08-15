# FreeLearn Radar — v1.3.0 + v1.3.1 Functional Verification

## Executive Summary

**Final runtime verdict: READY_FOR_HUMAN_REVIEW**

This run answered a different question from the earlier code review: not "does the
plan match the code" but "does the code actually work when it runs". The answer
changed the picture materially.

The previous validation could not reach a database — it recorded migration
validation as `PARTIAL — SQL not executed, no database available locally`, and
every database claim rested on reading SQL. There is no Docker, no Postgres and
no `psql` on this machine. So the first task was to build a real one: **PGlite**
(Postgres compiled to WASM) with the same extensions production needs
(`unaccent`, `pg_trgm`, `vector`), running the real `drizzle/*.sql` migrations,
plus a wire-protocol socket server so the **unmodified Next.js application** could
connect with its normal `postgres-js` driver and be exercised over HTTP.

That turned static claims into executed ones — **526 runtime checks across six
suites** — and surfaced eleven defects that no amount of code reading had caught,
including four that made shipped features completely non-functional in
production:

- **The daily-free surface could never display a verified coupon.**
  `course_offers.provider_id` was never populated, and the public query joined
  providers through it, so every verified 100%-off offer was silently dropped.
  The flagship v1.3.1 feature returned an empty state no matter what.
- **Two shipped queries threw on every call with the production driver.**
  `postgres-js` rejects a JS `Date` bound into a raw Drizzle `sql` template;
  PGlite accepts it. The coupon recheck queue (pre-existing) and the daily-free
  expiry filter (added by the previous remediation) both failed on every
  invocation, and `withDb` turned the exception into "no results".
- **Three feature flags were not runtime kill switches.** `compare`, `path` and
  `tracker` were statically prerendered, baking the build-time flag value into
  HTML. Flipping the flag did nothing until a redeploy.
- **pg_trgm typo tolerance never fired.** The threshold was unreachable: even an
  exact-word match scored below it.

All eleven were fixed, re-verified through the same runtime paths, and locked
down with regression tests. Every suite was then re-run from a pristine database
in a second pass and came back clean.

Nothing was committed, pushed or deployed.

---

## v1.3.0 Runtime Verification

**Working:** lexical search (keyword, VI accented, VI unaccented, typo-tolerant,
exact-title), provider aliases, VI→EN concept retrieval, filters, sorting,
pagination, truth filtering before ranking, honest empty state, `unmet_intent` /
`lexical_would_be_zero` persistence, embedding generation and persistence,
embedding versioning, changed-vs-unchanged re-embed, durable query embedding
cache with TTL, semantic retrieval with a calibrated floor, hybrid fusion, hybrid
pagination, every documented fallback layer, similar courses, course comparison
(now slug-shareable), learning paths, monetization kill switch in both positions,
affiliate allowlist and open-redirect guard, admin RBAC, cron authentication,
Vietnamese-only UI and SEO.

**Partial:** natural-language finder (deterministic constraint extraction is
wired and works; there is no AI intent call — `parseIntentWithOptionalAi` returns
`AI_STUB`); learning paths (renders search links, never claims a course that is
not in the catalog, but `courseIds` stays empty by design).

**Broken:** none remaining.

**Not wired:** `FEATURE_CROSS_LANGUAGE` (the flag is read nowhere; the VI→EN
requirement is now met deterministically by concept aliases instead).

**Config required:** live embedding provider (`NVIDIA_API_KEY`) — verified only
through `FakeEmbeddingProvider` and the missing-credential fallback path.

**Live verification required:** semantic relevance-floor calibration (needs human
relevance labels), §91 STOP 1 four-way benchmark, real USD embedding cost.

## v1.3.1 Runtime Verification

**Working:** coupon source registry with per-source kill switch, discovery from
source HTML to `DISCOVERED` candidates, URL parser identity separation,
`couponCode` preservation, duplicate suppression at both application and database
level, official verification, the full state machine, expiry at write and read,
BLOCKED recovery, re-verification idempotency, "Miễn phí hôm nay" end to end,
media resolution writing every `image_*` column, image SSRF boundary, fallback
rendering, access classification, multi-domain taxonomy and seeds, category-
balanced discovery selection, coverage statistics, admin coupon/coverage/media
surfaces on real data.

**Partial:** coupon verification evidence is HTML-heuristic rather than
checkout-truth (accepted risk carried forward from the code review — driving
checkout would breach Provider Policy).

**Broken:** none remaining.

**Not wired:** none remaining.

**Config required:** discovery search provider (`TAVILY_API_KEY`) — `/api/cron/discover`
correctly returns 503 with `pendingManualIntegrationTest` rather than reporting a
successful empty run.

**Live verification required:** coupon verification against real Udemy pages;
media coverage baseline against the real catalog.

---

## How the runtime was established

| Component | Approach |
|---|---|
| Database | PGlite (WASM Postgres) + `unaccent`, `pg_trgm`, `vector` |
| Schema | The real `drizzle/*.sql` files, applied in journal order |
| Application | Unmodified production build, `next start` |
| Wire protocol | `@electric-sql/pglite-socket` so `postgres-js` connects normally |
| Network | `globalThis.fetch` stubbed per test, so `safeHttpGet`, `validateSafeFetchUrl`, the redirect loop, content-type allowlist and size caps all execute for real |
| Secrets | Local placeholders only, to satisfy production env validation |

Three `devDependencies` were added for this (`@electric-sql/pglite`,
`-pgvector`, `-socket`). No production dependency changed; no application code
imports the harness. Reproduction instructions are in `scripts/verify/README.md`.

**Nothing was fabricated.** No coupon status, verification timestamp, image
result, discovery result or affiliate credential was written by the harness.
Every asserted status was produced by the code under test from the evidence it
was given.

---

## Verification matrix

Result values: WORKING, PARTIAL, BROKEN, NOT_WIRED, CONFIG_REQUIRED,
LIVE_VERIFICATION_REQUIRED, NOT_APPLICABLE.

### v1.3.0 — Search (M20.1–M20.4)

| Feature | UI | API | Service | DB | Cron | External | Runtime tested | Failure path tested | Result |
|---|---|---|---|---|---|---|---|---|---|
| Keyword search | ✓ | — | ✓ | ✓ | — | — | ✓ | ✓ | WORKING |
| VI search with diacritics | ✓ | — | ✓ | ✓ | — | — | ✓ | ✓ | WORKING |
| VI search without diacritics | ✓ | — | ✓ | ✓ | — | — | ✓ | ✓ | WORKING |
| Typo tolerance (pg_trgm) | ✓ | — | ✓ | ✓ | — | — | ✓ | ✓ | WORKING *(was BROKEN — fix R-5)* |
| Exact-title search | ✓ | — | ✓ | ✓ | — | — | ✓ | — | WORKING |
| Provider aliases | ✓ | — | ✓ | ✓ | — | — | ✓ | — | WORKING |
| VI → international course | ✓ | — | ✓ | ✓ | — | — | ✓ | — | WORKING *(was BROKEN — fix R-6)* |
| Filters (level/language/cert/duration/provider) | ✓ | — | ✓ | ✓ | — | — | ✓ | ✓ | WORKING |
| Sorting | ✓ | — | ✓ | ✓ | — | — | ✓ | — | WORKING |
| Pagination | ✓ | — | ✓ | ✓ | — | — | ✓ | ✓ | WORKING |
| Truth before ranking | ✓ | — | ✓ | ✓ | — | — | ✓ | ✓ | WORKING |
| Honest empty result | ✓ | — | ✓ | ✓ | — | — | ✓ | ✓ | WORKING |
| `unmet_intent` logging | — | — | ✓ | ✓ | — | — | ✓ | — | WORKING |
| Relevance floor | — | — | ✓ | ✓ | — | — | ✓ | ✓ | WORKING (gated: uncalibrated → semantic off) |
| Hybrid fusion + pagination | ✓ | — | ✓ | ✓ | — | — | ✓ | ✓ | WORKING |

### v1.3.0 — AI / Embedding (M20.2–M20.5)

| Feature | Runtime tested | Failure path tested | Result |
|---|---|---|---|
| Embedding generation + persistence | ✓ (10/10 rows, status OK) | ✓ | WORKING |
| Embedding versioning (no cross-version blending) | ✓ | ✓ | WORKING |
| Changed course re-embedded / unchanged skipped | ✓ | — | WORKING |
| `api_usage_log` per embedding call | ✓ | — | WORKING |
| Query embedding cache + hit count + TTL | ✓ | ✓ | WORKING |
| Semantic retrieval respects cosine floor | ✓ | ✓ | WORKING |
| Semantic cannot bypass Truth | ✓ (PAID/TRIAL/PREVIEW/DRAFT absent) | ✓ | WORKING |
| Embedding provider unavailable → lexical | ✓ | ✓ | WORKING |
| Vector timeout → lexical, `degraded` recorded | ✓ | ✓ | WORKING |
| Uncalibrated floor → semantic off, degraded | ✓ | ✓ | WORKING |
| Deterministic NL constraint extraction | ✓ | ✓ | WORKING |
| AI intent parser | — | — | NOT_WIRED (stub; documented) |
| Live embedding provider | — | ✓ (missing-key path) | CONFIG_REQUIRED |

### v1.3.0 — Discovery features (M20.6–M20.9)

| Feature | Runtime tested | Result |
|---|---|---|
| Similar courses (flag ON) | ✓ | WORKING |
| Similar courses eligibility (flag OFF path) | ✓ | WORKING |
| Course comparison via slug URL | ✓ | WORKING *(was BROKEN — fix R-9)* |
| Comparison rejects ineligible courses | ✓ | WORKING |
| Comparison makes no subjective claim | ✓ | WORKING |
| Learning paths render, invent nothing | ✓ | PARTIAL (no course picks by design) |
| Course detail integration | ✓ | WORKING |

### v1.3.0 — Monetization (M20.12–M20.13)

| Check | Flags OFF | Flags ON | Result |
|---|---|---|---|
| Course outbound still works | ✓ | ✓ | WORKING |
| Affiliate transformation disabled | ✓ | n/a | WORKING |
| Affiliate disclosure hidden | ✓ | n/a | WORKING |
| Enabled campaign reaches allowlisted destination | n/a | ✓ | WORKING |
| Click tracking persisted (provider + host, no raw IP) | n/a | ✓ | WORKING |
| Disabled provider does not leave origin | n/a | ✓ | WORKING |
| Off-allowlist destination refused, user still lands somewhere valid | n/a | ✓ | WORKING |
| Unknown campaign degrades safely | ✓ | ✓ | WORKING |
| Open-redirect guard (`locale` param, 5 payloads) | ✓ | ✓ | WORKING |
| Ranking unaffected by monetization | ✓ | ✓ | WORKING |
| Truth unaffected by monetization | ✓ | ✓ | WORKING |

### v1.3.1 — Coupon pipeline (M21.3–M21.4)

| Check | Runtime tested | Result |
|---|---|---|
| Source HTML → `DISCOVERED` candidates | ✓ | WORKING |
| `couponCode` preserved through normalization | ✓ | WORKING |
| `canonical_url` ≠ `offer_url` | ✓ | WORKING |
| Tracking params stripped without corrupting identity | ✓ | WORKING |
| Aggregator "100% OFF" claim → `DISCOVERED` only | ✓ | WORKING |
| Malformed URL / missing code / wrong provider → `INVALID` | ✓ | WORKING |
| Verified 100%-off page → `ACTIVE_100_OFF` | ✓ | WORKING |
| Discount below 100% → `ACTIVE_DISCOUNTED`, never free | ✓ | WORKING *(was unreachable — fix R-4)* |
| Blocked/failed provider fetch → `BLOCKED`/`UNKNOWN` | ✓ | WORKING |
| Provider-reported expiry → `EXPIRED`/`INVALID` | ✓ | WORKING |
| Recorded `expires_at` in the past outranks a 100%-off page | ✓ | WORKING |
| `EXPIRED`/`INVALID` not resurrected | ✓ | WORKING |
| `BLOCKED` recovers on a later recheck | ✓ | WORKING *(was stranded — fix R-3)* |
| Duplicate offer from a second source suppressed (app + DB index) | ✓ | WORKING |
| Multiple codes for one course stay distinct offers, one course row | ✓ | WORKING |
| Source unavailable / malformed → no invented candidates | ✓ | WORKING |
| Re-verification idempotent (no extra rows) | ✓ | WORKING |
| Kill switch (global + per source) | ✓ | WORKING |
| Cron scheduled and authenticated | ✓ | WORKING |
| Live Udemy verification | — | LIVE_VERIFICATION_REQUIRED |

### v1.3.1 — "Miễn phí hôm nay" (M21.7)

| Check | Runtime tested | Result |
|---|---|---|
| Verified `ACTIVE_100_OFF` appears | ✓ HTTP | WORKING *(was BROKEN — fix R-1)* |
| Expired offer absent | ✓ HTTP | WORKING |
| Unverified `FREE_WITH_COUPON` never labelled verified | ✓ | WORKING |
| Freshness from stored `verified_at` | ✓ | WORKING |
| Coupon CTA only for verified offers | ✓ | WORKING |
| Outbound URL preserves `couponCode` | ✓ | WORKING |
| Vietnamese copy | ✓ | WORKING |

### v1.3.1 — Media (M21.6)

| Check | Runtime tested | Result |
|---|---|---|
| Valid official image → `OK` + resolved URL | ✓ | WORKING |
| 404 → `BROKEN` + reason | ✓ | WORKING |
| Wrong content-type → rejected | ✓ | WORKING |
| Oversized body → rejected | ✓ | WORKING |
| Network failure → `BROKEN`, course survives | ✓ | WORKING |
| Missing source → `FALLBACK`, not `OK` | ✓ | WORKING |
| SSRF target → `BLOCKED`, never fetched | ✓ (19 hostile URLs) | WORKING |
| Redirect to private IP blocked before the hop is issued | ✓ | WORKING |
| Redirect loop bounded | ✓ | WORKING |
| `image_*` columns persisted with real timestamps | ✓ | WORKING |
| Fallback never claims to be official artwork | ✓ | WORKING |
| Media failure never removes a course | ✓ | WORKING |
| Recheck window honoured (bounded runs) | ✓ | WORKING |
| Kill switch | ✓ | WORKING |

### v1.3.1 — Access classification (M21.5)

| Access type | Free list | Daily free | Durable free | Runtime tested | Result |
|---|---|---|---|---|---|
| FREE_FULL | ✓ | — | ✓ | ✓ | WORKING |
| FREE_AUDIT | ✓ | — | ✓ | ✓ | WORKING |
| FREE_WITH_COUPON | ✓ | ✓ | — | ✓ | WORKING |
| TEMPORARILY_FREE | ✓ | ✓ | — | ✓ | WORKING |
| FREE_PREVIEW | ✗ | ✗ | ✗ | ✓ | WORKING |
| FREE_TRIAL | ✗ | ✗ | ✗ | ✓ | WORKING |
| PAID | ✗ | ✗ | ✗ | ✓ | WORKING |
| UNKNOWN (insufficient evidence) | ✗ | ✗ | ✗ | ✓ | WORKING |
| Certificate independent of access | — | — | — | ✓ | WORKING |
| "Enroll for free" never → FREE_FULL (any provider) | — | — | — | ✓ | WORKING *(was violated — fix R-7)* |

### v1.3.1 — Multi-domain discovery (M21.1–M21.2)

All thirteen required domains are declared, seeded, and reachable by at least one
enabled discovery query. Measured seed distribution:

```
programming=15  ai=12  data-science=11  soft-skills=8  cloud=7  cybersecurity=7
business=6  marketing=4  personal-development=3  office-productivity=3
languages=3  devops=2  product-management=2  finance=2  lifestyle-health=2
career=2  humanities=2  science-engineering=2  education=2  design=2
project-management=1
```

| Check | Runtime tested | Result |
|---|---|---|
| 13 top-level domains declared | ✓ | WORKING |
| No seeded category has zero queries | ✓ | WORKING |
| Selection interleaves categories (thin domains reached in run 1) | ✓ | WORKING |
| Budget limit still respected, no duplicates | ✓ | WORKING |
| `discovery_category_stats` written by real runs | ✓ | WORKING |
| `verified`/`published` counters accumulate | ✓ | WORKING |
| Coverage admin shows never-run categories | ✓ | WORKING |
| Live discovery run | — | CONFIG_REQUIRED (`TAVILY_API_KEY`) |

### Public UI walkthrough (HTTP)

| Surface | Result |
|---|---|
| Homepage (real DB content, no ineligible course) | WORKING |
| Search (7 query classes, filters, page 2, XSS, SQL-ish input) | WORKING |
| Miễn phí hôm nay | WORKING |
| Category (populated + empty) | WORKING |
| Topic landing | WORKING |
| Course detail (+ outbound CTA, JSON-LD, related) | WORKING |
| Similar / Comparison / Learning paths | WORKING |
| Interests | WORKING (client-persisted by design) |
| Vietnamese-only UI, no switcher, no `/en` nav links | WORKING |
| `html lang="vi"` server-rendered | WORKING *(was `en` — fix R-8)* |
| Vietnamese SEO metadata | WORKING *(was English — fix R-11)* |
| Sitemap Vietnamese-only, includes daily-free | WORKING |
| No runtime/hydration errors on any probed route | WORKING |

### Admin walkthrough (HTTP, authenticated)

Fourteen admin pages rendered 200 with real data for an authenticated ADMIN;
all fourteen redirect anonymous visitors to login; seven mutating APIs reject
anonymous calls with 401. Login succeeds with a seeded credential, sets an
`HttpOnly; SameSite=Lax` cookie, rate-limits repeated failures with 429, and
logs out. Admin chrome is Vietnamese and `noindex`. Coupon operations show the
real offer, coverage shows never-run categories, media quality shows real counts.
An invalid role payload is rejected rather than mass-assigned.

### Workers / scheduler

| Job | Registered | Authenticated | Runs | Writes state | Result |
|---|---|---|---|---|---|
| `/api/cron/coupons` (discovery + verification + media) | ✓ `vercel.json` | ✓ 401 without secret | ✓ | ✓ candidates, offers, `image_*`, audit log | WORKING |
| `/api/cron/embed` | ✓ | ✓ | ✓ | ✓ embeddings + `api_usage_log` | WORKING |
| `/api/cron/discover` | ✓ | ✓ | honest 503 without key | — | CONFIG_REQUIRED |
| `/api/cron/verify` | ✓ | ✓ | — | — | CONFIG_REQUIRED |
| `/api/cron/monitor` | ✓ | ✓ | — | — | CONFIG_REQUIRED |
| Media resolution independent of coupon flag | ✓ | ✓ | ✓ | ✓ | WORKING |

---

## Remediation performed

Eleven defects found by runtime execution, all fixed and re-verified.

**R-1 — Verified coupons could never reach "Miễn phí hôm nay" (critical).**
`upsertCourseOffer` was never given a `providerId`, and `listActive100OffOffers`
joined `providers` through `course_offers.provider_id`. The join produced a null
provider, and `daily-free.ts` drops any row without one. Every verified
100%-off offer was silently discarded — the headline v1.3.1 surface could not
work. Fixed by populating `provider_id` at write time (preferring the resolved
course's provider) and by resolving the join through
`coalesce(course_offers.provider_id, courses.provider_id)` so a null can never
hide an offer again.
Files: `coupon-verification-runner.ts`, `coupon-repository.ts`.

**R-2 — Two shipped queries threw on every call with the production driver
(critical).** `postgres-js` rejects a JS `Date` bound into a raw Drizzle `sql`
template (`ERR_INVALID_ARG_TYPE ... Received an instance of Date`); PGlite and
neon-http accept it. Four sites were affected, two of them live: the coupon
recheck queue (`listOffersDueForRecheck`, **pre-existing** — coupon
re-verification could never have run in production) and the daily-free expiry
filter. `withDb` swallowed the exception, so the symptom was a page confidently
rendering "no results". Fixed by using typed operators (`gt`, `lt`, `lte`,
`isNull`, `or`) at all four sites, matching the pattern
`affiliate-repository.ts` already used.
Files: `coupon-repository.ts` (×2), `course-embedding-repository.ts`,
`media-resolution-runner.ts`. Guarded by `driver-parameter-regression.test.ts`.

**R-3 — `BLOCKED` coupon offers were stranded permanently.**
`nextCouponRecheckAt` computes a 48-hour backoff for `BLOCKED`, but
`listOffersDueForRecheck` excluded the status, so a transient rate limit or
captcha removed the offer from the pipeline for good. Fixed by including
`BLOCKED` in the recheck set. `EXPIRED`/`INVALID` remain excluded, matching the
§126.3 priority list.

**R-4 — `ACTIVE_DISCOUNTED` was unreachable.** A provider page showing
"85% off / $12.99" produced no discount evidence, so the offer fell through to
`UNKNOWN` — wrong status, wrong recheck cadence, wrong admin reporting. No Truth
invariant was breached (`UNKNOWN` is not publishable), but the state existed in
name only. Fixed by extracting a partial discount percentage, explicitly
excluding 100 so the stricter 100%-off branch keeps sole ownership of that case.

**R-5 — pg_trgm typo tolerance never fired.** `similarity()` compares whole
strings, so a short query against a longer title cannot reach the 0.28 threshold.
Measured: exact word "excel" against "excel co ban mien phi" scores **0.273** —
below the floor — and the typo "pyton" scores 0.103. The branch was dead for
every realistic query. Fixed by adding `word_similarity(query, title)`, which
scores the best word-boundary span. Threshold 0.5 derived from measurement:
positives land at 0.5–1.0, unrelated queries at 0.0–0.063.

**R-6 — Vietnamese queries could not reach international courses.** §116.6 and
§96.1 require it, and no lexical operator can bridge it: "quan ly du an" scores
**0.000** similarity *and* 0.000 word_similarity against "Project Management
Fundamentals". Semantic retrieval is the general answer but stays off until its
floor is calibrated. Fixed with a deterministic Vietnamese→English concept alias
map carrying the plan's own worked examples, and by making alias expansions
*separate* search phrases — the previous code concatenated them into one string,
which also meant provider aliases never matched via LIKE (`%ms learn microsoft
learn%` matches no title). Level words were deliberately excluded from aliasing
to avoid broadening every query.

**R-7 — "Enroll for free" became `FREE_FULL` on non-Coursera providers.**
`classifyAccessFromText` fell through to `FREE_FULL` for any text containing
"free", directly violating §11. Latent (the function is not on the runtime path)
but a trap for whoever wires it. Fixed by requiring wording that actually claims
whole-course access; anything weaker resolves to `UNKNOWN`.

**R-8 — Every page served `html lang="en"`.** The root layout hard-coded it;
`LocaleHtmlLang` patched it only after hydration, so crawlers and screen readers
saw English on a Vietnamese-only product. Fixed to render `defaultLocale`
server-side.

**R-9 — Course comparison could not be shared.** §94.3 documents
`?compare=slug-a,slug-b`, but the page resolved courses by UUID only, so a
shareable URL never resolved. Fixed by accepting slugs and ids.

**R-10 — Three feature flags were not runtime kill switches.** `compare`, `path`
and `tracker` were in the prerender manifest, so their flag values were frozen at
build time; flipping a flag required a redeploy. This contradicts §77 rule 32 and
the under-15-minute rollback of §98.3, and it failed invisibly — the page returns
200 with a "not found" body, which reads as a disabled feature rather than a
broken switch. Fixed with `export const dynamic = "force-dynamic"`, matching what
`mien-phi-hom-nay` already did. Guarded by `feature-flag-runtime.test.ts`.

**R-11 — English SEO metadata and an indexable soft 404.** Category, collection
and monthly-best titles were English regardless of locale ("Best Free Online
Courses — January 1999" was observed live), violating §116.2. Separately, a
missing category was marked `index: true` while returning HTTP 200, making every
bogus `/category/<slug>` an indexable thin page — exactly what §103 forbids.
Also fixed: a DRAFT course's title leaked through `generateMetadata` even though
the page calls `notFound()`, and the unavailable-course description was English.

---

## Regression tests added

| File | Guards |
|---|---|
| `src/test/driver-parameter-regression.test.ts` | Scans SQL-issuing source for a JS `Date` bound into a raw `sql` template — the R-2 class that only the production driver rejects. Includes a self-test proving the scanner catches the exact shape of the two shipped defects. |
| `src/test/feature-flag-runtime.test.ts` | Every `FEATURE_*`-gated page opts out of static rendering, so a flag stays a runtime kill switch (R-10). |

Existing suites were extended during the earlier review passes and remain in
place. Test count: **604 across 72 files** (was 599 across 70).

The runtime harness itself is the primary regression asset for the other nine
defects: `npm run verify:db`, `npm run verify:http` and `npm run verify:flags-on`
re-execute all 526 checks.

---

## Quality gates

Actual repository commands.

| Command | Result | Notes |
|---|---|---|
| `npm run lint` | **PASS** | 0 errors, 1 pre-existing warning (`no-page-custom-font`) |
| `npm run typecheck` | **PASS** | clean, harness included |
| `npm run test` | **PASS** | 72 files, 604 tests |
| `npm run build` | **PASS** | compiled, 70/70 static pages, real DB connected |
| `npm run verify:db` | **PASS** | 332 checks (79 + 78 + 65 + 110) |
| `npm run verify:http` | **PASS** | 152 checks, flags at deploy defaults |
| `npm run verify:flags-on` | **PASS** | 42 checks, flags enabled |
| Migration validation | **PASS** | 14 migrations executed against real Postgres — previously `PARTIAL, not executed` |
| Security regression | **PASS** | RBAC, CSRF, XSS, SSRF (19 hostile URLs), open redirect (5 payloads), rate limiting, proxy probes |
| Coupon regression | **PASS** | 65 runtime checks + unit suites |
| Media regression | **PASS** | media suite + SSRF table |
| Search regression | **PASS** | 78 runtime checks |
| Vietnamese UI regression | **PASS** | i18n suites + HTTP copy/lang/metadata checks |
| Search evaluation (NDCG/P@5) | **NOT MEASURED** | dataset has 0 graded labels of 62 queries |

Both runtime passes were run end to end; PASS 2 used a pristine database.

---

## Database side effects verified

Asserted by reading rows back with raw SQL rather than through the ORM that wrote
them, so a mapping bug cannot hide a persistence bug.

Coupon candidates (status, code, canonical/offer URLs, source attribution),
course offers (status transitions, `verified_at`, `expires_at`, `next_recheck_at`,
`discount_percent`, `course_id`, `provider_id`, `candidate_id`), no orphaned
candidate references, no duplicate course or offer rows, coupon source health and
run timestamps, `courses.image_*` (status, source type, resolved URL, fallback
reason, checked-at), course embeddings (status, model, version, vector),
`query_embedding_cache` (row + hit count), `api_usage_log` per embedding call,
`search_queries` (retrieval mode, degraded, latency, `unmet_intent`,
`lexical_would_be_zero`, ranking config version, normalized query, language),
`discovery_category_stats` (accumulating counters, unique per slug),
`affiliate_clicks` (provider, destination host, no raw IP), `admin_audit_log`
(`COUPON_RUN`).

Idempotency confirmed for: migration replay, embedding backfill, coupon
re-verification, duplicate candidate insertion, media recheck window.

---

## Failure paths verified

Embedding provider missing → degraded, lexical results still served. Vector
timeout → degraded fallback. Uncalibrated relevance floor → semantic disabled,
request marked degraded. Mixed embedding versions → zero cross-version reads.
Coupon source 503 → source marked failing, no invented candidates. Source HTML
with no coupon links → zero candidates. Provider 403/captcha → `BLOCKED`, never
free. Provider 500 → `UNKNOWN`. Malformed coupon URL → `INVALID`. Missing coupon
code → `INVALID`. Image 404 → `BROKEN`. Image wrong content-type → rejected.
Image oversized → rejected. Image network failure → `BROKEN`, course survives.
Image redirect to private IP → blocked before the request is issued. Image
redirect loop → bounded. Search provider key missing → honest 503, no false
success. Disabled affiliate provider → no off-origin redirect. Off-allowlist
destination → refused, user still lands on a valid page. Unknown campaign →
safe on-origin redirect. Hostile `locale` values → same-origin in both flag
states. Anonymous admin access → login redirect or 401. Unauthenticated cron →
401. Repeated failed logins → 429.

No raw internal error was exposed on any public surface; no false FREE state and
no false `ACTIVE_100_OFF` was produced on any failure path.

---

## Security runtime verification

| Surface | Result |
|---|---|
| RBAC | PASS — 14 admin pages gated, 7 mutating APIs 401 anonymously, ADMIN session renders all 14 |
| IDOR | PASS — invalid role payload rejected, not mass-assigned |
| CSRF | PASS — session cookie `HttpOnly; SameSite=Lax` |
| XSS | PASS — script tag in query not reflected; JSON-LD blocks parse with no raw angle brackets |
| SQL injection | PASS — `python' OR 1=1--` handled as text |
| SSRF | PASS — 19 hostile URL classes rejected; redirect-to-private-IP blocked pre-request; loop bounded |
| Open redirect | PASS — 5 payload classes stay same-origin, flags OFF and ON |
| Rate limiting | PASS — login 429; outbound click endpoints remain unlimited (carried finding) |
| External URL safety | PASS — no public endpoint proxies a URL, image or vector |
| Secrets | PASS — none in responses; production boot enforces secret length |

---

## Monetization readiness

| Dimension | Verdict |
|---|---|
| Implementation | **PASS** — abstraction, allowlist, disclosure, click tracking, single outbound boundary all exercised |
| Kill switch | **PASS** — verified in both positions; OFF keeps the hop on-origin and hides disclosure |
| Click tracking | **PASS** — persisted with provider and destination host, no raw IP |
| Outbound fallback | **PASS** — disabled provider, off-allowlist destination and unknown campaign all degrade to a valid on-origin page; course outbound never blocked |
| Redirect safety | **PASS** — allowlist enforced; open-redirect guard holds in both flag states |
| Ranking independence | **PASS** — organic order unchanged, no PAID course promoted |
| Truth independence | **PASS** — daily-free and search unaffected by monetization |
| Coursera | **CONFIG_REQUIRED** — mechanism verified with a credential-free destination; no affiliate ID exists |
| Shopee | **CONFIG_REQUIRED** — commerce provider seeded disabled; disabled path verified |
| Other providers | none configured |

**Required external configuration:** a real affiliate account per network, its
partner/tracking identifier, the network-approved destination template, and the
network's required disclosure wording. None of these were fabricated.

**Recommendation: KEEP_DISABLED.**

The implementation is sound and its safety properties are verified, but no
affiliate credential exists, so enabling it today would produce untracked
outbound traffic with a disclosure the network has not approved. Enable after
credentials are configured, one provider at a time, per §114.9.

---

## Remaining findings

1. **Site-wide soft 404 (confirmed, root cause proven, not fixed).** Every
   `notFound()` returns HTTP 200. Proven causal by experiment: removing
   `src/app/[locale]/loading.tsx` and the course-level `loading.tsx` turned
   `/vi/course/nope`, `/vi/course/draft-course-not-live` and `/vi/tracker` into
   real 404s, while routes retaining their own `loading.tsx` stayed at 200. A
   `loading.tsx` boundary above a `notFound()` call commits a 200 before the
   status can be set.

   Not fixed because the two remedies trade one plan requirement for another:
   deleting the boundaries removes the skeleton states §132.6 requires. The
   indexing harm is neutralised — every not-found metadata path now sets
   `noindex`, including the category path fixed in R-11 — so what remains is
   status-code correctness for crawlers and monitoring. **This is a UX-vs-SEO
   decision for a human**, and the one-line fix is known.

2. **`withDb` renders a database failure as absence of data** (carried from the
   code review). This run demonstrated the severity concretely: R-1 and R-2 were
   both invisible in production precisely because a thrown query became "no
   results". Recommend a scoped follow-up distinguishing empty from failed.

3. **Outbound click endpoints are not rate limited** (carried). `/course/[slug]/go`
   and `/go/affiliate` write a row per request with no limit.

4. **`EMBEDDING_DIMENSION` can silently disagree with the schema.** The column is
   hard-coded `vector(1024)`; setting the env var to anything else makes every
   embedding write fail and marks every course `FAILED`, with an opaque truncated
   SQL string as the only diagnostic. Discovered while configuring the harness.
   §107 anticipates changing embedding models, so this deserves a fail-fast guard.

5. **Embedding daily token budget is per-run, not per-day** (carried).

6. **`FEATURE_CROSS_LANGUAGE` still gates nothing.** The VI→EN requirement is now
   met deterministically (R-6), so the flag is redundant rather than harmful, but
   it remains a switch with nothing behind it.

7. **AI intent parsing is a stub** (carried). `FEATURE_NL_COURSE_FINDER` now gates
   real deterministic constraint extraction, so the flag is no longer inert, but
   there is no model call.

8. **NL intent quota is process-memory** (carried) — ineffective across serverless
   instances, though there is no AI call behind it to protect.

9. **No retention job for `search_queries`.** §86.2 and §98.2 require bounded
   retention with a stated number of days; nothing prunes the table. Normalized
   query text accumulates indefinitely.

10. **Coupon verification evidence is HTML-heuristic** (accepted risk, carried).

---

## Configuration required

| Item | Blocks | Why not verifiable locally |
|---|---|---|
| `TAVILY_API_KEY` | Live discovery runs | External search API; the route correctly returns 503 without it |
| `NVIDIA_API_KEY` | Live embedding + any future AI intent | External provider; verified via `FakeEmbeddingProvider` and the missing-key fallback |
| Affiliate credentials (Coursera, Shopee) | Enabling monetization | Requires real accounts and network-approved templates; fabricating them is forbidden |
| `RELEVANCE_FLOOR` | Semantic and hybrid retrieval | Must be derived from human relevance labels (§89.5) |
| Production `DATABASE_URL` | Neon-specific behaviour | Verified against real Postgres, but not Neon itself |

## Live verification required

1. **Relevance floor calibration.** Graded relevance labels (0–3) for the
   62-query dataset from two independent annotators with recorded agreement
   (§86.4), then derive the cosine threshold. Until then semantic and hybrid
   retrieval stay off by construction and §91 STOP 1 cannot be evaluated.
2. **Coupon verification against real Udemy pages.** The HTML-evidence heuristics
   are the one coupon path fixtures cannot cover.
3. **A real discovery run** once the search key exists, to confirm the
   category-balanced selection behaves against live results.
4. **Migration 0013 against Neon.** Executed against real Postgres here; Neon's
   driver and permissions differ.
5. **Media coverage baseline** against the real catalog.
6. **Real USD embedding cost.**
7. **Mobile/visual QA on a device.** Markup and copy were verified over HTTP;
   layout was not rendered.
8. **SEO migration monitoring** after the Vietnamese-only sitemap change.

---

## Final Verdict

**READY_FOR_HUMAN_REVIEW**

Every repository-fixable defect found by runtime execution is fixed, re-verified
through the same path that exposed it, and covered by a regression test or the
reproducible harness. No feature remains BROKEN or NOT_WIRED apart from
`FEATURE_CROSS_LANGUAGE`, whose requirement is now satisfied by other means and
which is documented rather than hidden. Every CONFIG_REQUIRED and
LIVE_VERIFICATION_REQUIRED item names what is missing and why.

Two things a reviewer should weigh before deploying:

- **The soft-404 decision is deliberately left open** (finding 1). Root cause is
  proven and the fix is one line per route, but it costs the loading skeletons
  §132.6 asks for. The indexing risk is already neutralised.
- **Monetization should stay disabled** until real affiliate credentials exist.
  The mechanism is verified; the configuration is absent.

The most important outcome is not the eleven fixes. It is that four shipped
features — the daily-free coupon surface, coupon re-verification, typo tolerance,
and three feature kill switches — were **completely non-functional** while
appearing correct to code review, static analysis, a full unit suite and a green
build. Each one required executing the real path to see.

Nothing was committed, pushed or deployed. All changes remain in the working tree.
