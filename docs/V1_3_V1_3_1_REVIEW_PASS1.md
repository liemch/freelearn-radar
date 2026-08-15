# v1.3 + v1.3.1 — Independent Review, PASS 1

Scope: verify the complete implementation of **v1.3 (M20.0–M20.14)** and
**v1.3.1 (M21.0–M21.12)** against `project-plan-v1_3.md` and
`project-plan-v1.3.1.md`. Read-first audit; no prior report was treated as
evidence.

Baseline captured before any change:

| Gate | Command | Result |
|---|---|---|
| lint | `npm run lint` | PASS (0 errors, 2 warnings) |
| typecheck | `npm run typecheck` | PASS |
| tests | `npm run test` | PASS — 67 files, 508 tests |

Repository shape: single Next.js 15 App Router app (not the `apps/web` +
`apps/monitor` monorepo the v1.3 plan assumes). Background work runs as Vercel
cron routes under `src/app/api/cron/*` instead of a separate worker process.
This is recorded as an accepted architectural deviation, not a defect — the plan
explicitly says table/service names must adapt to the real repository.

---

## Method

1. Read both plans end to end.
2. Inventoried architecture, quality commands, schema, migrations, cron wiring.
3. Built a requirement traceability matrix per milestone (below).
4. For every claim, demanded four kinds of evidence: implementation code,
   database object, **runtime call path**, and test. A class, component,
   migration or test existing on its own was scored `PARTIAL`, never `PASS`.
5. Verified subagent findings independently before recording them. Two reported
   issues were rejected on inspection and are listed in
   *Rejected candidate findings*.

---

## Traceability matrix

### v1.3 / M20

| Milestone | Requirement | Evidence | Runtime wired | Status |
|---|---|---|---|---|
| M20.0 | Baseline + intent diagnosis + eval dataset | `src/domain/search/baseline.ts`, `data/search-eval/v1/queries.json`, `docs/GATE_B_INTENT_DIAGNOSIS.md` | Yes (`scripts/search-baseline.ts`, admin benchmark) | PARTIAL — dataset has no graded labels, so NDCG/P@5 cannot be computed |
| M20.0 | Thresholds committed to versioned config | `src/config/search-thresholds.ts` | Yes | PASS |
| M20.1 | unaccent + pg_trgm + weighted lexical | `drizzle/0008_m20_1_lexical.sql`, `src/domain/search/lexical-sql.ts` | Yes — `queryCatalog` → `buildLexicalMatchCondition` | PASS |
| M20.1 | `immutable_unaccent` IMMUTABLE wrapper for indexes | `drizzle/0008` L8–16 | Yes | PASS |
| M20.2 | Semantic document builder, no raw HTML | `src/domain/embedding/semantic-document.ts` | Yes | PASS |
| M20.2 | `EmbeddingProvider` separate from `AIProvider` + fake for tests | `src/services/embedding/embedding-provider.ts` | Yes | PASS |
| M20.2 | Embedding versioning, no silent mixing | `course_embeddings` unique `(course_id, model, version)`; `semantic.ts` L127–128 filters both | Yes | PASS |
| M20.2 | Idempotent bounded backfill | `src/domain/embedding/embed-batch.ts`, `/api/cron/embed` | Yes | PASS |
| M20.2 | `api_usage_log` for embedding calls | `embed-batch.ts` L142–153 | Batch only — **not** for query-time embeddings | PARTIAL |
| M20.3 | Hybrid retrieval + RRF fusion | `src/domain/search/hybrid.ts`, `fusion.ts` | Domain yes — **page ignores fused ids** | **FAIL** → P1-8 |
| M20.3 | Query embedding cache (durable) | `query_embedding_cache` table, `semantic.ts` L59–66 | Yes | PASS |
| M20.3 | Cache TTL | `QUERY_EMBEDDING_CACHE_TTL_DAYS` in `env.ts` | Never read | FAIL → P2-6 |
| M20.3 | Truth filter before public result | `buildCatalogConditions` L110–145, `semantic.ts` L125–137 | Yes | PASS |
| M20.3 | Relevance floor | `fusion.ts` L25–66 | Applied in RRF only | PARTIAL |
| M20.3 | `unmet_intent` + `lexical_would_be_zero` persisted | `search-query-repository.ts` L43–61 | Yes | PASS |
| M20.3 | Vector/embedding failure → lexical fallback, no 500 | `hybrid.ts` L92–148, `search/page.tsx` L154 | Yes | PASS |
| M20.4 | Ranking config centralized + versioned | `src/config/search-ranking.ts` | Yes | PASS |
| M20.4 | CTR is not a ranking signal | No click/CTR read in `ranking.ts` / `fusion.ts` / `hybrid.ts` | Yes | PASS |
| M20.4 | Reason codes | `searchRankingConfig.reasonCodes` | Produced, not surfaced as chips | PARTIAL |
| M20.5 | Deterministic-first intent parsing | `src/domain/search/nl-intent.ts` | Used by `learning-path.ts` only | PARTIAL |
| M20.5 | AI intent parser | `parseIntentWithOptionalAi` returns `source: "AI_STUB"` | Test-only; no route/page caller | **FAIL** → P1-10 |
| M20.5 | Per-IP + global cap | `consumeNlIntentQuota` | Process memory; unreachable in prod | FAIL → P1-10 |
| M20.5 | No public embedding proxy | asserted in `m20-hardening.test.ts` L21–29 | Yes | PASS |
| M20.6 | Similar courses, eligible only | `similar-courses.ts` L44–45 | Yes when flag ON | PASS (flag ON) |
| M20.6 | Same guarantee on default path | `related-courses.ts` — no eligibility filter | Flag OFF is the deploy default | **FAIL** → P1-4 |
| M20.7 | Compare ≤ 3, eligible only, no subjective claims | `compare-courses.ts` L70–72, `compare/page.tsx` | Yes | PASS |
| M20.8 | Learning path 3–7 steps, real courses only | `learning-path.ts` | Renders search links, `courseIds: []` | PARTIAL (honest by design) |
| M20.9 | Cross-language VI↔EN | `FEATURE_CROSS_LANGUAGE` in `env.ts` L111 only | No retrieval logic reads it | **FAIL** → P1-10 (flag gates nothing) |
| M20.10 | Discovery analytics | `search_queries` extension, `/admin/search`, `/admin/analytics` | Yes | PASS |
| M20.11 | Outage/hardening tests | `src/test/m20-hardening.test.ts` | Yes | PASS |
| M20.12 | Affiliate abstraction, allowlist, no ranking effect | `affiliate-link-service.ts`, `affiliate.test.ts` | Yes | PASS |
| M20.12 | Affiliate outbound never an open redirect | `/go/affiliate` | **Exploitable** | **FAIL** → P0-1 |
| M20.13 | Contextual placements, disclosure, no commission ordering | `resolve-placements.ts`, `commerce-relevance.ts` | Yes | PASS |
| M20.14 | vi default, no language switcher | `config.ts` `PUBLIC_LANGUAGE_SWITCHER = false`, `getAdminLocale()` pinned `vi` | Yes | PASS |
| M20.14 | Vietnamese canonical/sitemap only, no EN hreflang | `sitemap.ts` L13–15, `seo.ts` L16 | Emits `/en/*` + `x-default → /en` | **FAIL** → P2-2 |

### v1.3.1 / M21

| Milestone | Requirement | Evidence | Runtime wired | Status |
|---|---|---|---|---|
| M21.0 | Runtime audit + baseline + known-positive coupon fixture | `docs/M21_0_BASELINE.md`, `offer-url.test.ts` | Yes | PASS |
| M21.1 | 13 multi-domain top-level categories | `multi-domain.ts` L22–142, seeded via `db/seed/data.ts` L47–69 | Yes | PASS |
| M21.1 | Single source of truth for taxonomy | `M21_TAXONOMY_CATEGORIES` vs `SEED_CATEGORIES` | Duplicated; expansion helper dead | PARTIAL → P3-3 |
| M21.2 | Per-category discovery budget, no starvation | `DISCOVERY_BUDGET_CATEGORY_SLUGS` L146–168 | Test-only; selection is global FIFO | **FAIL** → P1-9 |
| M21.2 | VI + EN seeds per domain | `db/seed/data.ts` | 89 queries; `design` has 0, five domains have 1 | PARTIAL → P1-9 |
| M21.2 | `discovery_category_stats` written | `discovery-engine.ts` L101–107 | Yes for queries/candidates | PARTIAL — `verified`/`published` never bumped → P2-9 |
| M21.3 | Coupon source registry, discovery-only | `coupon_sources`, `coupon-discovery-runner.ts` L62–64 | Yes | PASS |
| M21.3 | Aggregator claim never becomes ACTIVE_100_OFF | discovery writes `DISCOVERED` only (L160–173) | Yes | PASS |
| M21.3 | `canonical_url ≠ offer_url`, couponCode preserved | `offer-url.ts` L66–72, `url.ts` L78–83 | Yes | PASS |
| M21.4 | Verification requires official fetch | `coupon-verification-runner.ts` L185–219 via `safeHttpGet` | Yes | PASS |
| M21.4 | Expired coupon cannot stay active | `expires_at` never compared to now, at write or read | No | **FAIL** → P1-1, P1-2 |
| M21.4 | Re-verification bounded + backoff | `nextCouponRecheckAt`, `listOffersDueForRecheck` | Yes | PASS |
| M21.4 | Coupon pipeline actually runs | `/api/cron/coupons` exists | **Not in `vercel.json`** | **FAIL** → P1-7 |
| M21.5 | Access taxonomy not conflated | `price_type` enum incl. `FREE_PREVIEW` (0012) | `classifyAccessFromText` test-only; `free-status.ts` never emits `FREE_PREVIEW` | PARTIAL → P3-4 |
| M21.5 | Certificate dimension independent | `courses.certificate_type` + `certificate-status.ts` | Yes | PASS |
| M21.6 | Media resolver + validator + fallback | `media-resolver.ts`, `course-image-service.ts` | **No production caller**; flag unread | **FAIL** → P1-6 |
| M21.6 | Image fetch SSRF-safe | `validateImageUrl` | Materially weaker than `validateSafeFetchUrl` | **FAIL** → P1-5 |
| M21.6 | Broken image never breaks card or hides course | `course-card-visual.tsx` L32–33, `course-visual.ts` | Yes | PASS |
| M21.6 | Media quality metrics + admin filter | `/admin/media-quality` | Reads real rows, but rows are default `MISSING` | PARTIAL → P1-6 |
| M21.7 | "Miễn phí hôm nay" surface | `/[locale]/mien-phi-hom-nay`, `daily-free.ts` | Yes | PASS |
| M21.7 | Only verified 100% shows "Coupon 100%" | `daily-free-card.tsx` L23 | Unverified `FREE_WITH_COUPON` gets same badge | **FAIL** → P1-3 |
| M21.7 | Real freshness, never faked | `formatVerificationFreshnessVi` from `verifiedAt` | Yes | PASS |
| M21.8 | Interests, no persistent sensitive profile | `interests.ts`, `interest-picker.tsx` | Yes | PASS |
| M21.9 | Topic/category/SEO discovery pages | `topic/[slug]`, `category/[slug]`, `free-courses/[topic]` | Yes | PASS |
| M21.9 | Daily-free surface indexed | `/mien-phi-hom-nay` absent from `sitemap.ts` | No | FAIL → P2-7 |
| M21.10 | Discovery UX refresh, badge limits, responsive | `home-hero.tsx`, `course-card.tsx`, `daily-free-card.tsx` | Yes | PASS |
| M21.11 | Admin coupon / coverage / media surfaces | `/admin/coupons`, `/admin/coverage`, `/admin/media-quality` | Real DB reads | PARTIAL — coverage hides never-run categories → P2-9 |
| M21.12 | Cost guards, flags default OFF, kill switches | `env.ts` L115–156 | Yes | PASS |
| M21.12 | Security regression suite | `src/test/m21-hardening.test.ts` | Yes | PARTIAL — missed P0-1 and P1-5 |

---

## Findings

Severity: **P0** critical (security/Truth breach reachable in production),
**P1** high (invariant violation or declared milestone not wired),
**P2** medium, **P3** low.

---

### P0-1 — Open redirect in the affiliate outbound hop

- **Severity** P0
- **Version** v1.3 (M20.12)
- **Milestone/requirement** §113.6 "open-redirect protection", §13 "No affiliate
  link may become an arbitrary open redirect"
- **Observed** `GET /go/affiliate?locale=/evil.com` issues a 307/302 to
  `https://evil.com/`. Reachable by any anonymous visitor with no cookie, and
  reachable **even when monetization is disabled**, because the disabled branch
  redirects first.
- **Evidence** `src/app/go/affiliate/route.ts` L21–28. `locale` falls through to
  `request.nextUrl.searchParams.get("locale")` with no `isLocale()` check, then
  is interpolated into `new URL(`/${locale}`, request.url)`. Verified against
  Node's WHATWG URL parser:

  ```
  new URL('/' + '/evil.com', 'https://site.com/go/affiliate').href
  → 'https://evil.com/'
  ```

  Backslash and multi-slash variants (`/\evil.com`, `//evil.com`) resolve the
  same way. Four separate redirect sites in the file use this value.
- **Impact** Phishing and OAuth-style redirect abuse under the product's own
  domain and brand; the affiliate hop becomes an open redirector.
- **Root cause** The cookie value is validated with `isLocale`; the query
  parameter shares the same variable but skips validation.
- **Fix** Validate the query parameter through `isLocale` before use, and build
  redirect targets from a locale-typed value only.
- **Regression test required** Yes — assert that hostile `locale` values redirect
  to a same-origin path, for both monetization ON and OFF.

---

### P1-1 — Expired coupons still surface as active 100% deals

- **Severity** P1
- **Version** v1.3.1 (M21.4/M21.7)
- **Requirement** §120 "Coupon expired/invalid → không tiếp tục hiển thị như
  active free deal"; §126.4 "khi hết: không còn ở Miễn phí hôm nay, không còn
  badge Coupon 100%"
- **Observed** An offer row with `status = 'ACTIVE_100_OFF'` and `expires_at` in
  the past is still returned to the public surface, still renders the
  "Coupon 100%" badge, and still shows the "Nhận khóa học miễn phí" CTA until a
  re-verification pass happens to change its status.
- **Evidence** `src/db/repositories/coupon-repository.ts` L143–156 —
  `listActive100OffOffers` filters `eq(courseOffers.status, "ACTIVE_100_OFF")`
  and nothing else. `src/domain/discovery/daily-free.ts` L54–73 checks
  publication, free-list eligibility and `isPublicCoupon100Off`, but never reads
  `row.offer.expiresAt`.
- **Impact** The product's core promise — "còn hiệu lực hay không" — breaks
  silently. Users are sent to a paid checkout believing the course is free.
  Expiry is precisely the volatility the milestone exists to handle.
- **Root cause** Expiry was modelled as a scheduling input for re-verification
  only, never as a publication gate.
- **Fix** Filter `expires_at IS NULL OR expires_at > now()` in the repository,
  and re-assert it in `daily-free.ts` as defense in depth.
- **Regression test required** Yes.

---

### P1-2 — Verification can promote an already-expired offer

- **Severity** P1
- **Version** v1.3.1 (M21.4)
- **Requirement** §126.1 state machine; "Expired coupon cannot remain active"
- **Observed** `pastExpiry` is derived exclusively from a regex over provider
  HTML (`/offer.*(expired|ended)/i`). The stored `expires_at` /
  `source_expires_at` is never compared against the clock, so an offer past its
  own stated expiry can transition to `ACTIVE_100_OFF`.
- **Evidence** `src/domain/coupon/coupon-verification-runner.ts` L133
  (`const pastExpiry = /offer.*(expired|ended)/i.test(body)`), L291
  (`expiresAt: candidate.sourceExpiresAt` stored but unused thereafter);
  `src/domain/coupon/coupon-service.ts` L149–172 —
  `resolveCouponVerificationStatus` receives no expiry timestamp.
- **Impact** Illegal transition `EXPIRED → ACTIVE_100_OFF`; the state machine has
  no clock-based guard.
- **Root cause** Evidence type models expiry as a boolean derived from page text
  rather than from the offer's own recorded expiry.
- **Fix** Feed the stored expiry into the evidence and treat
  `expiresAt <= now` as `pastExpiry`.
- **Regression test required** Yes.

---

### P1-3 — Unverified `FREE_WITH_COUPON` renders the verified "Coupon 100%" badge

- **Severity** P1
- **Version** v1.3.1 (M21.7)
- **Requirement** §120 "Chỉ 100% OFF mới được gắn Coupon 100%"; §125.3
  discovery-only rule; §11 "Only verified 100% discount may display Coupon 100%"
- **Observed** When fewer than six verified offers exist, `daily-free.ts` falls
  back to catalog rows and labels any `priceType === "FREE_WITH_COUPON"` course
  `offerStatus: "FREE_WITH_COUPON"`. The card then renders the identical
  `coupon100Badge` used for authoritatively verified `ACTIVE_100_OFF` offers.
- **Evidence** `src/components/public/daily-free-card.tsx` L23:
  `if (offerStatus === "ACTIVE_100_OFF" || offerStatus === "FREE_WITH_COUPON")`
  → same label, same variant. Fallback assignment at
  `src/domain/discovery/daily-free.ts` L93–98.
- **Impact** The badge that is supposed to mean "we verified 100% off against the
  provider" is shown for rows that carry no offer verification at all. The CTA is
  correctly stricter (`showCouponCta` requires `ACTIVE_100_OFF`), which makes the
  inconsistency worse: badge claims verified, CTA behaves unverified.
- **Root cause** Badge switch conflates a course-level price type with an
  offer-level verified status.
- **Fix** Distinct, weaker label for the unverified fallback; reserve the
  verified label for `ACTIVE_100_OFF`.
- **Regression test required** Yes.

---

### P1-4 — Ineligible courses leak into Course Detail related section on the default path

- **Severity** P1
- **Version** v1.3 (M20.6)
- **Requirement** §93.1 candidate rules; M20.6 gate "0 course không eligible
  xuất hiện"; §9 "Only eligible courses may appear as free"
- **Observed** With `FEATURE_SIMILAR_COURSES` unset — the deploy default per
  §83.1 rule 32 — Course Detail renders `listRelatedCoursesFor`, whose SQL filters
  only `status = 'PUBLISHED'`. `selectRelatedCourses` then ranks without any
  eligibility check. `PAID`, `FREE_TRIAL` and `FREE_PREVIEW` courses can appear
  inside a free-course surface.
- **Evidence** `src/db/repositories/course-repository.ts` L628 —
  `.where(and(eq(courses.status, "PUBLISHED"), sql`${courses.id} <> ${source.id}`))`
  with no `notInArray(courses.priceType, FREE_LIST_EXCLUDED_PRICE_TYPES)`.
  `src/domain/discovery/related-courses.ts` L25–27 filters only `id` and
  `status`. Contrast `src/domain/search/similar-courses.ts` L44–45, which does
  call `isEligibleForFreeLists`. `listSimilarCoursesFor` shares the same
  unfiltered SQL (L680) and is saved only by the domain-layer filter.
- **Impact** Direct Truth invariant breach on the highest-traffic page, on the
  code path that runs by default.
- **Root cause** Eligibility was added to the new M20.6 service but not to the
  pre-existing related-courses path it falls back to, and not to the shared SQL.
- **Fix** Exclude ineligible price types in both repository queries and add the
  eligibility filter to `selectRelatedCourses`.
- **Regression test required** Yes.

---

### P1-5 — Image fetch SSRF defenses are materially weaker than the HTML fetch path

- **Severity** P1
- **Version** v1.3.1 (M21.6/M21.12)
- **Requirement** §128.3 "Không biến image fetcher thành SSRF surface"; §12
  "Image fetching must remain SSRF-safe"; §17 private IP ranges
- **Observed** `validateImageUrl` performs ad-hoc string checks and misses:
  - `172.17.0.0` – `172.31.255.255` (only the literal prefix `172.16.` is caught)
  - loopback other than `127.0.0.1` (e.g. `127.0.0.2`, `127.1`)
  - link-local other than the exact string `169.254.169.254`
  - CGNAT `100.64.0.0/10`, `0.0.0.0/8` beyond the literal `0.0.0.0`
  - decimal/octal/hex IP obfuscation (`http://2130706433/`)
  - IPv6 loopback/ULA/link-local (`[::1]` only as a literal string; `[fd00::1]`,
    `[::ffff:127.0.0.1]` pass)
  - credentials in URL
  - `localhost.localdomain`, `*.localhost`, `metadata.google.internal`

  Additionally the fetch uses `redirect: "follow"`, so intermediate hops are
  never validated and there is no hop limit. Only `response.url` is re-checked,
  which is a post-hoc check after the requests have already been issued.
- **Evidence** `src/services/images/course-image-service.ts` L41–46 (`BLOCKED_HOSTS`),
  L69–76 (prefix checks), L97–111 (`redirect: "follow"`, final-URL-only
  validation). A strictly stronger validator already exists at
  `src/lib/safe-fetch-url.ts` and the HTML path already does per-hop validation
  with a hop cap at `src/services/fetch/safe-http-client.ts` L73–139.
- **Impact** Server-side request forgery against internal services when any
  external image URL is attacker-influenced (course candidate metadata is
  untrusted external input by §120).
- **Root cause** The image path predates `safe-fetch-url.ts` and was never
  migrated onto it; two divergent URL validators now coexist.
- **Fix** Delegate `validateImageUrl` to `validateSafeFetchUrl`, and follow
  redirects manually with per-hop validation and a bounded hop count.
- **Regression test required** Yes — table-driven hostile URL fixtures plus a
  redirect-to-private-IP case.

---

### P1-6 — M21.6 media pipeline has no production caller

- **Severity** P1
- **Version** v1.3.1 (M21.6)
- **Requirement** §128.1–128.5, §138.1 "mỗi claim phải map tới runtime wiring"
- **Observed** `resolveCourseMedia` / `resolveMediaStatus` are never invoked
  outside tests. `FEATURE_MEDIA_RESOLVER` appears exactly once in the codebase —
  its own schema declaration. No code writes `image_status`,
  `image_resolved_url`, `image_source_type`, `image_checked_at`,
  `image_fallback_reason` or the dimension columns. `/admin/media-quality`
  therefore reports schema defaults (`MISSING` / `NONE`) for the whole catalog,
  and every media metric in §128.5 is structurally 0.
- **Evidence** Repository-wide search for `resolveCourseMedia` returns only
  `media-resolver.ts` (definition), `media-resolver.test.ts`,
  `m21-hardening.test.ts`. `FEATURE_MEDIA_RESOLVER` → `src/lib/env.ts` L118 only.
  `src/domain/candidate/approve-candidate.ts` L261–263 sets `imageSourceUrl` and
  `imagePolicy` but no resolver output. No cron route imports the media domain.
- **Impact** A milestone reported DONE is a library with tests and no runtime
  path — the exact "false completion" pattern the review targets. Media quality
  is unobservable, so image regressions are undetectable.
- **Root cause** Resolver, schema and admin read were built; the writer and the
  scheduler hook were not.
- **Fix** Add a bounded media-resolution runner, gate it on
  `FEATURE_MEDIA_RESOLVER`, invoke it from the M21 cron route, and set a
  deterministic non-network `image_status` at approval time.
- **Regression test required** Yes.

---

### P1-7 — Coupon discovery and verification are never scheduled

- **Severity** P1
- **Version** v1.3.1 (M21.3/M21.4)
- **Requirement** §125, §126.3 bounded recheck schedule; §14 "worker exists but
  scheduler never invokes it"
- **Observed** `/api/cron/coupons` implements discovery + verification correctly
  and is cron-authenticated, but it is absent from `vercel.json`. Nothing invokes
  it in production, so no candidate is ever discovered, no offer is ever
  verified, and no `ACTIVE_100_OFF` row can ever come into existence. The entire
  "Miễn phí hôm nay" surface therefore permanently serves the fallback branch —
  which is the branch that carries P1-3.
- **Evidence** `vercel.json` L3–24 registers `discover` ×2, `verify`, `monitor`,
  `embed`. No `coupons` entry. Route at
  `src/app/api/cron/coupons/route.ts` L18–35. `docs/PRODUCTION_READINESS.md`
  L49–51 also omits it, so the gap is not merely a config slip.
- **Impact** The headline feature of v1.3.1 cannot run in production.
- **Root cause** Cron registration was not updated when the route was added.
- **Fix** Register the cron and correct the production documentation.
- **Regression test required** Yes — assert every `/api/cron/*` route has a
  scheduler entry.

---

### P1-8 — Hybrid/semantic results never reach the rendered search page

- **Severity** P1
- **Version** v1.3 (M20.3)
- **Requirement** §89 hybrid search; §91 STOP 1 measures hybrid against lexical;
  §14 "service exists but is never called" / "route exists but UI never uses it"
- **Observed** `searchHybrid` runs and returns `courseIds`, but the page uses
  those ids only to **reorder the 12-item lexical page it already fetched**. Any
  fused id outside that slice is discarded. In the case the milestone exists for
  — a query where lexical returns nothing and semantic finds relevant courses —
  `catalog.items` is empty, so `reordered` is empty, so the page renders the
  honest-empty state while `hybrid.courseIds` holds real matches. Analytics
  simultaneously record `retrievalMode: "HYBRID"` with `resultCount: 0`.
- **Evidence** `src/app/[locale]/search/page.tsx` L130–143. `reordered` is built
  purely by partitioning `catalog.items`; there is no query to hydrate courses by
  id. `catalog.total` also stays the lexical count, so pagination reflects
  lexical only.
- **Impact** M20.3 is not wired end to end. Every STOP 1 comparison between
  HYBRID and LEXICAL UPGRADED measured through the page would be invalid, and the
  +15% NDCG gate cannot be honestly evaluated.
- **Root cause** No repository function to load eligible courses by id list, so
  the page reordered what it had.
- **Fix** Add an order-preserving, truth-filtered `listEligibleCoursesByIds` and
  hydrate the fused ids; keep lexical as the fallback when hydration is empty.
- **Regression test required** Yes.

---

### P1-9 — Balanced multi-domain discovery budget is not applied at runtime

- **Severity** P1
- **Version** v1.3.1 (M21.2)
- **Requirement** §124.2 "Mỗi top-level category có discovery budget/seed riêng
  … tránh category quan trọng bị starvation"; §26 "discovery architecture must
  not structurally starve non-Tech domains"
- **Observed** `DISCOVERY_BUDGET_CATEGORY_SLUGS` exists and is asserted by a
  test, but no runtime code reads it. `listDueDiscoveryQueries` orders globally by
  `last_run_at ASC NULLS FIRST, success_count ASC` and truncates at
  `DISCOVERY_QUERY_LIMIT`, with no per-category quota. Each category's share of
  the budget therefore equals its share of seeded queries. Counting the seed
  data: `programming` 15, `ai` 12, `data-science` 11 — 38 of 89 queries (~43%) in
  three Tech categories — while `finance`, `career`, `humanities`,
  `science-engineering`, `education` and `lifestyle-health` have 1 each and
  `design` has **0** despite being a seeded browsable category.
- **Evidence** `src/domain/taxonomy/multi-domain.ts` L146–168 (constant);
  `src/domain/discovery/discovery-query-service.ts` L43–51 (selection);
  `src/db/seed/data.ts` (`SEED_DISCOVERY_QUERIES`). `discovery_category_stats`
  is written but never consumed by selection, despite its own comment claiming it
  "avoids Tech starvation" (`src/db/schema/discovery-category-stats.ts` L12–14).
- **Impact** The stated fix for DOMAIN BIAS — finding 2 of the four v1.3.1
  findings — is observability only. The bias it was meant to correct is still
  structurally encoded in seed volume.
- **Root cause** Budget was modelled as a constant and a stats table; the
  scheduler was never changed to honour either.
- **Fix** Interleave due queries round-robin across categories so no category can
  consume a disproportionate share of a run, and seed the starved domains.
- **Regression test required** Yes.

---

### P1-10 — Three declared v1.3 feature flags gate nothing

- **Severity** P1
- **Version** v1.3 (M20.5, M20.9)
- **Requirement** §14 "feature flag exists but endpoint ignores it"; §92 NL
  Course Finder; §96 cross-language
- **Observed**
  - `FEATURE_NL_COURSE_FINDER` — no runtime reader. `parseIntentWithOptionalAi`
    is called only from tests and returns `source: "AI_STUB"` with the
    deterministic parse; there is no AI intent call.
  - `FEATURE_CROSS_LANGUAGE` — declared in `env.ts` and read nowhere.
  - NL intent quota counters (`consumeNlIntentQuota`) live in module-scope `Map`s
    and are reset on every cold start, so the §85 caps (2 000/day, 20/IP/hour)
    are not enforceable on serverless even once a caller exists.
- **Evidence** `src/domain/search/nl-intent.ts` L216–238; repository search for
  `parseIntentWithOptionalAi` → `nl-intent.ts` + `nl-intent.test.ts` only;
  `FEATURE_CROSS_LANGUAGE` → `src/lib/env.ts` L111 only.
- **Impact** Two milestones are reported as shipped-but-off when in fact there is
  nothing behind the switch. §97 STOP 2 per-flag decisions are meaningless for
  these two.
- **Root cause** Flags and supporting library code landed ahead of the callers.
- **Fix (bounded)** Wire the **deterministic** intent parser into the search path
  behind `FEATURE_NL_COURSE_FINDER` so the flag controls real behaviour. Do
  **not** build an AI intent integration — that is feature development, outside
  the remit of a validation run. Record the AI portion of M20.5 and all of M20.9
  as NOT DONE with evidence rather than claiming completion.
- **Regression test required** Yes, for the deterministic wiring.

---

### P2-1 — JSON-LD injection via unescaped `</script>`

- **Severity** P2
- **Version** v1.3 / pre-existing
- **Requirement** §18 XSS; §120 "External HTML/text luôn là untrusted input"
- **Observed** `JSON.stringify` does not escape `<`, `>` or U+2028/U+2029. A
  course title or description containing `</script>` terminates the JSON-LD
  block and allows arbitrary markup into the page.
- **Evidence** `src/components/seo/json-ld.tsx` L5. Course titles and
  descriptions come from external provider metadata and AI analysis, and flow
  into `buildCourseJsonLd`.
- **Impact** Stored XSS on public course/category pages if hostile metadata is
  ever ingested or approved.
- **Root cause** Standard `JSON.stringify`-into-`<script>` pitfall.
- **Fix** Escape `<`, `>`, `&` and the JS line terminators before injection.
- **Regression test required** Yes.

---

### P2-2 — SEO still publishes English URLs and hreflang

- **Severity** P2
- **Version** v1.3 (M20.14)
- **Requirement** §116.8 "Vietnamese canonical only / Vietnamese sitemap only /
  no EN hreflang"; §27
- **Observed** `sitemap.ts` emits both `/en/...` and `/vi/...` for every static,
  category, provider, course and monthly-collection URL. `buildLocaleAlternates`
  emits an `en` hreflang for every page and sets `x-default` to the **English**
  URL, actively pointing crawlers at the locale the product no longer supports.
- **Evidence** `src/app/sitemap.ts` L13–15 (`localizedUrls` maps over `locales`,
  which is `["en","vi"]`); `src/lib/i18n/seo.ts` L13–16.
- **Impact** Search engines keep indexing and preferring English duplicates of a
  Vietnamese-only product. This is the discoverability half of M20.14 left
  undone.
- **Root cause** `PUBLIC_LANGUAGE_SWITCHER` was flipped off, but the SEO layer
  still enumerates `locales`.
- **Fix** Emit Vietnamese URLs only in the sitemap; canonical and `x-default`
  point at the Vietnamese route; drop the `en` hreflang. Keep `/en/*` routes
  serving (per §117 rules 7–8, they must not 404 before an indexing audit).
- **Regression test required** Yes.

---

### P2-3 — `assertSafeHttpUrl` does not block credentials in URL

- **Severity** P2
- **Observed** The function's own comment says "Block credentials-in-URL and
  empty hosts", but `isValidHttpUrl` only checks `url.hostname`. `https://
  udemy.com@evil.com/` passes and its hostname is `evil.com`.
- **Evidence** `src/lib/url.ts` L22–26, L36–62.
- **Impact** Outbound course redirects can display a trusted-looking authority
  while navigating elsewhere. Host allowlists still resolve correctly, so this is
  a deception vector rather than a bypass.
- **Fix** Reject `username`/`password` components. **Regression test** Yes.

---

### P2-4 — `coupon_candidates.offer_url` has no UNIQUE constraint

- **Severity** P2
- **Requirement** §15 "application invariants that should instead be enforced by
  the database"; §16 concurrency
- **Observed** Duplicate suppression is a read-then-insert in application code.
  Two concurrent discovery runs, or a cron retry after timeout, can both pass the
  existence check and insert duplicate candidates. `course_offers.offer_url` does
  have a unique index; candidates do not.
- **Evidence** `src/db/schema/coupon.ts` L118–124 (non-unique indexes only);
  `drizzle/0012` L130–135; `coupon-discovery-runner.ts` L151–157.
- **Fix** Add a unique index (deduplicating existing rows first) and make the
  insert conflict-tolerant. **Regression test** Yes.

---

### P2-5 — `scripts/neon-bootstrap.sql` is stale by a whole migration

- **Severity** P2
- **Observed** The committed bootstrap SQL stops at `0011_m20_12_monetization`.
  It contains none of migration 0012: no `coupon_sources`, `coupon_candidates`,
  `course_offers`, `discovery_category_stats`, no `courses.image_*` columns, no
  `FREE_PREVIEW` enum value. Its embedded seed also carries the old English
  category set rather than the M21 multi-domain taxonomy.
- **Evidence** Search for `coupon_candidates|course_offers|discovery_category_stats|0012_m21`
  in `scripts/neon-bootstrap.sql` → 0 matches. Generator exists at
  `scripts/generate-neon-bootstrap.ts`.
- **Impact** An operator following the manual Neon bootstrap path gets a database
  missing every v1.3.1 object.
- **Fix** Regenerate from the journal. **Regression test** Yes — assert the
  bootstrap covers the latest journal entry.

---

### P2-6 — Query embedding cache TTL is never enforced

- **Severity** P2
- **Requirement** §89.3 "TTL 30 ngày"; §99.3 cost guards
- **Observed** `QUERY_EMBEDDING_CACHE_TTL_DAYS` is parsed and defaulted but never
  read. Cache rows live forever, so a stale vector keeps being served after a
  model or version change window and the table grows unbounded.
- **Evidence** `src/lib/env.ts` L97–101; no reader in
  `src/db/repositories/course-embedding-repository.ts`.
- **Fix** Apply the TTL on read. **Regression test** Yes.

---

### P2-7 — The M21.7 flagship surface is not in the sitemap

- **Severity** P2
- **Observed** `/mien-phi-hom-nay` is absent from `staticPaths`.
- **Evidence** `src/app/sitemap.ts` L49–55.
- **Fix** Add it. **Regression test** Yes.

---

### P2-8 — Hybrid semantic-only fill skips the eligibility check

- **Severity** P2
- **Observed** The first loop applies `isEligibleForFreeLists` to ids found in
  the lexical page; the top-up loop that adds semantic-only ids applies no check.
  `searchSemantic` filters upstream, so this is currently latent, but it is
  exactly the "semantic relevance bypasses Truth" shape §10 forbids.
- **Evidence** `src/domain/search/hybrid.ts` L163–179.
- **Fix** Make eligibility a property of hydration so no path can skip it.
- **Regression test required** Yes.

---

### P2-9 — Category coverage is blind to the starvation case it exists to detect

- **Severity** P2
- **Observed** Two defects in one surface:
  1. `/admin/coverage` lists only rows present in `discovery_category_stats`. A
     category that has never run has no row and is therefore invisible — the
     most severe starvation case is the one the page cannot show.
  2. `verifiedCount` and `publishedCount` are never incremented anywhere, so
     those columns and the candidate→publish conversion in §133.3 are always 0.
- **Evidence** `src/app/admin/coverage/page.tsx` L36–40;
  `bumpDiscoveryCategoryStats` callers — only
  `discovery-engine.ts` L101–107, passing `queriesRun`, `candidatesFound`,
  `zeroCandidateRuns`.
- **Fix** Union the stats with the seeded category list and show never-run
  categories as starved; bump verified/published at approval.
- **Regression test required** Yes.

---

### P2-10 — `degraded` is under-reported when the hybrid call itself throws

- **Severity** P2
- **Observed** `withDb("search.hybrid", …)` returning `null`, or the surrounding
  `try` catching, leaves `degraded = false`. The request silently ran
  lexical-only while analytics record a healthy non-degraded search, which
  corrupts the §85 "semantic degraded rate < 2%" gate.
- **Evidence** `src/app/[locale]/search/page.tsx` L88, L113–121, L154–156.
- **Fix** Mark degraded when the semantic path was expected but unavailable.
- **Regression test required** Yes.

---

### P2-11 — `unmet_intent` conflates "zero results" with "no result above floor"

- **Severity** P2 — **documented, not changed**
- **Observed** On the pure lexical path the repository defaults `unmetIntent` to
  `zeroResult`. §89.6 defines `unmet_intent` as "không có kết quả trên floor",
  which is a strictly different predicate.
- **Evidence** `src/db/repositories/search-query-repository.ts` L43–61.
- **Decision** Left as-is. When no relevance floor was applied, treating zero
  results as unmet intent is the conservative reading and preserves the catalog
  gap signal §89.6 exists to protect. Narrowing it risks losing signal.

---

### P3 findings

| ID | Finding | Evidence |
|---|---|---|
| P3-1 | Admin `loading.tsx` sr-only text is English ("Loading"); `admin/layout.tsx` title is English — M20.14 requires Vietnamese admin chrome | `src/app/admin/loading.tsx` L16, `src/app/admin/layout.tsx` L8 |
| P3-2 | §104 env vars absent: `EMBEDDING_DAILY_BUDGET_USD`, `RELEVANCE_FLOOR`, `SIMILAR_MAX_PER_PROVIDER`, `LEARNING_PATH_MIN/MAX_STEPS`, `NL_INTENT_CACHE_TTL_DAYS`, `SEARCH_*_VERSION`, `SEARCH_P95_BUDGET_MS`. Values live in versioned config instead — arguably better than env, but the plan asked for env | `src/lib/env.ts`, `src/config/search-*.ts` |
| P3-3 | Taxonomy has two sources of truth: `M21_TAXONOMY_CATEGORIES` + `buildExpandedCategorySeeds` (both dead) vs `SEED_CATEGORIES` (live). `resolveCategoryAlias` / `CATEGORY_ALIAS_DICTIONARY` also dead | `src/domain/taxonomy/multi-domain.ts` L22–269 |
| P3-4 | `classifyAccessFromText` is test-only; `free-status.ts` never emits `FREE_PREVIEW`, so the enum value added by 0012 is unreachable from classification | `src/domain/access/access-classifier.ts`, `src/domain/verification/free-status.ts` L153–159 |
| P3-5 | `logger` performs no secret redaction; it serialises whatever payload it is handed | `src/lib/logger.ts` |
| P3-6 | Lint warning: unused `_omitted` | `src/services/ai/nvidia-nim-provider.test.ts` L75 |
| P3-7 | RBAC asymmetry: single candidate approve requires ADMIN, bulk approve accepts EDITOR | `src/app/api/admin/candidates/[id]/route.ts` vs `.../bulk/route.ts` |

---

## Rejected candidate findings

Recorded so PASS 2 does not re-litigate them.

- **"Coupon verification is stubbed."** Rejected. `verifyOfferUrl` performs a
  real `safeHttpGet` against the offer URL and refuses `ACTIVE_100_OFF` without
  a successful official fetch. The evidence extraction is regex-over-HTML, which
  is a fidelity limitation worth stating in the final report, not a fabricated
  verification.
- **"SQL injection in lexical search."** Rejected. `lexical-sql.ts` passes the
  folded query as a bound parameter (`${pattern}`, `${folded}`) through Drizzle;
  there is no string concatenation and no `to_tsquery` construction from user
  input.
- **"Admin pages have no RBAC."** Partially rejected. Middleware requires a
  session for all `/admin/*` and `/api/admin/*`, and every mutating admin API
  enforces a role via `assertAdmin` / `assertEditor` / explicit checks. Only the
  read-only asymmetry in P3-7 stands.
- **"`/en` routes still exist, therefore M20.14 failed."** Rejected as stated.
  §117 rules 7–8 explicitly forbid removing indexed locale routes before an SEO
  migration. The genuine defect is the SEO layer advertising them (P2-2), not
  their continued existence.

---

## Counts

| Severity | Found |
|---|---|
| P0 | 1 |
| P1 | 10 |
| P2 | 11 |
| P3 | 7 |

Remediation plan: fix P0 and all P1; fix P2-1 through P2-10; document P2-11;
fix P3-1 and P3-6; document the remaining P3 items. The AI portion of M20.5 and
the retrieval portion of M20.9 will be recorded as NOT DONE rather than
implemented, because building them is feature development and outside the remit
of this validation run.
