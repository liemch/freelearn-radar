# v1.3 + v1.3.1 — Independent Review, PASS 2

Second independent pass, run after PASS 1 remediation and after PASS 1 full
gates went green. PASS 1 fixes were **not** assumed correct: both plans were
re-read and the changed runtime paths were re-inspected adversarially, looking
first for defects the remediation itself introduced.

State at the start of PASS 2:

| Gate | Result |
|---|---|
| `npm run lint` | PASS (0 errors, 1 pre-existing warning) |
| `npm run typecheck` | PASS |
| `npm run test` | PASS — 69 files, 583 tests |
| `npm run build` | PASS |

---

## Part 1 — PASS 1 findings re-verified

| PASS 1 ID | Claim | Re-verified? | Notes |
|---|---|---|---|
| P0-1 | Affiliate open redirect | FIXED | Both cookie and query parameter now go through `isLocale`; hostile-input table test added. |
| P1-1 | Expired coupon on public surface | FIXED, then **extended** — see PASS2-5 | The first fix was incomplete; the fallback branch readmitted the same course. |
| P1-2 | Verification could promote an expired offer | FIXED | Stored expiry now outranks page text; five-case test added. |
| P1-3 | Unverified coupon wore the verified badge | FIXED | Superseded in practice by PASS2-5: unverified coupon rows no longer reach the surface at all. Weaker label retained as defense in depth. |
| P1-4 | PAID leaked into related courses | FIXED | Excluded in both repository queries and in `selectRelatedCourses`. |
| P1-5 | Image SSRF weaker than HTML path | FIXED | Now shares `validateSafeFetchUrl`; manual per-hop redirect validation with a hop cap. 15-case hostile URL table added. |
| P1-6 | Media pipeline had no caller | FIXED, then **corrected** — see PASS2-4 | Runner wired to the cron; the batch-limit bug is PASS2-4. |
| P1-7 | Coupon cron unscheduled | FIXED | Registered; a test now asserts every cron route has a schedule. |
| P1-8 | Hybrid results never rendered | FIXED, then **corrected** — see PASS2-1 | The hydration fix broke pagination. |
| P1-9 | Discovery budget not applied | FIXED | Category interleave + seeds for starved domains. |
| P1-10 | Three flags gated nothing | PARTIAL, as planned | `FEATURE_NL_COURSE_FINDER` now gates real deterministic behaviour. AI intent and `FEATURE_CROSS_LANGUAGE` remain NOT DONE by decision, not oversight. |
| P2-1 | JSON-LD injectable | FIXED | `<`, `>`, `&`, U+2028/9 escaped; round-trip test. |
| P2-2 | EN sitemap + hreflang | FIXED | Vietnamese-only; `/en/*` routes still serve. |
| P2-3 | userinfo accepted in URLs | FIXED | |
| P2-4 | No unique index on candidate offer_url | FIXED | Migration 0013 + conflict-tolerant insert. |
| P2-5 | Stale bootstrap SQL | FIXED | Regenerated from the journal (14 migrations). |
| P2-6 | Cache TTL unenforced | FIXED | |
| P2-7 | Daily-free absent from sitemap | FIXED | |
| P2-8 | Fusion top-up skipped eligibility | FIXED | |
| P2-9 | Coverage blind to never-run categories | FIXED | Union with the seeded taxonomy; verified/published now bumped at approval. |
| P2-10 | `degraded` under-reported | FIXED, then **extended** | Also now true when the floor is uncalibrated (PASS2-2). |
| P2-11 | `unmet_intent` conflation | Unchanged by decision | Still the conservative reading; documented. |
| P3-1, P3-6 | Vietnamese admin chrome, lint warning | FIXED | |

---

## Part 2 — New findings

### PASS2-1 — Hybrid pagination served page 1 under every page number

- **Severity** P1 — **regression introduced by PASS 1**
- **Version** v1.3 (M20.3)
- **Observed** After the PASS 1 hydration fix, `/search?q=...&page=2` rendered
  the *same twelve* results as page 1 while `Pagination` displayed page 2. The
  pre-fix code at least reordered lexical page 2, so PASS 1 traded a wrong
  ordering for a wrong page.
- **Root cause** `searchHybrid` slices its own lexical read to
  `page: 1, pageSize: lexicalTopK` and returned `courseIds` already truncated to
  `pageSize`. The page then hydrated `hybrid.courseIds.slice(0, pageSize)` —
  offset 0 regardless of `filters.page`. `catalog.total` was
  `Math.max(catalog.total, fusedItems.length)`, mixing a lexical count with a
  fused count, so `totalPages` did not describe either result set.
- **Impact** Pagination on hybrid search was non-functional and silently wrong:
  no error, plausible-looking output, different content than the URL claimed.
  This is precisely the "silently wrong" class §36 asks for.
- **Fix** `HybridSearchResult` now carries `courseIds` (the full ranked eligible
  set) and `pageIds` (the slice for `filters.page`, computed by a `pageSlice`
  helper that also guards non-finite and non-positive pages). The page hydrates
  `pageIds` and derives `total`/`totalPages` from `courseIds.length` alone.
- **Side benefit** `benchmark.ts` consumes `courseIds` for NDCG@10; it now
  receives up to the full top-K instead of 12, so NDCG@10 is computable over a
  real depth-10 window rather than a truncated one.
- **Regression test** `src/test/v13-pass2-regression.test.ts` — PASS2-1 block.

---

### PASS2-2 — Semantic retrieval had no relevance floor at all

- **Severity** P1 — **pre-existing, missed by PASS 1**
- **Version** v1.3 (M20.3, §89.5)
- **Observed** `searchSemantic` returns `scored.slice(0, topK)` — the top 50 by
  cosine — with **no minimum similarity**. For a query the catalog genuinely
  cannot answer, it therefore returns 50 arbitrary courses (the best of a bad
  set). Those enter RRF, score ≥ 1/61 ≈ 0.0164, clear the configured
  `relevanceFloor` of 0.01, and `unmetIntent` is computed as
  `eligibleIds.length === 0` — which is now false. The honest empty state can
  never fire, and the catalog-gap signal §89.6 exists to protect is erased.
- **Evidence** `src/domain/search/semantic.ts` L134–151 (pre-fix): the loop
  pushed every eligible row and sliced. No threshold anywhere in the file.
- **Why PASS 1 missed it** PASS 1 verified that Truth filtering ran before
  ranking, and it does. But eligibility and relevance are different questions:
  every course returned was genuinely free-eligible, just not relevant. The
  invariant that broke was §89.5 / §20 ("low-quality semantic matches must not
  appear merely to avoid zero results"), not the Truth invariant.
- **The `relevanceFloor` in config is not this floor.** Its arithmetic is fixed
  by `rrfK = 60` and `weight = 1`:

  | Position | RRF score | vs floor 0.01 |
  |---|---|---|
  | rank 1, one list | 1/61 ≈ 0.01639 | kept |
  | rank 40, one list | 1/100 = 0.01000 | kept (exactly at floor) |
  | rank 41, one list | 1/101 ≈ 0.00990 | dropped |
  | rank 50 in **both** lists | 2/110 ≈ 0.01818 | kept |

  So it is a rank cutoff at ~40 for single-list hits, and any document appearing
  in both lists survives no matter how weak the match. It cannot express a
  relevance judgement, because an RRF score encodes position, not similarity.
- **Fix, and why it stops short of a number** §89.5 requires the floor to be set
  from the labelled evaluation set ("lấy phân bố score của cặp đã label 0 vs
  ≥ 2"), and §86.4 requires two independent annotators to produce those labels.
  Those labels do not exist — `data/search-eval/v1/queries.json` has no graded
  relevance, which is also why the benchmark reports null NDCG. Inventing a
  threshold would fabricate exactly the kind of gate §140.4 forbids.

  So the mechanism is implemented and the gate is made mechanical instead of
  aspirational:
  - `RELEVANCE_FLOOR` (the plan's own §104 name) is read as a cosine minimum and
    applied inside `searchSemantic`.
  - It has **no default**. `readRelevanceFloor` reports `{ calibrated: false }`
    for empty, non-numeric, or out-of-range values.
  - While uncalibrated, `searchHybrid` keeps the semantic path **off** even when
    `FEATURE_SEMANTIC_SEARCH` / `FEATURE_HYBRID_SEARCH` are true, logs
    `search.semantic.uncalibrated`, and reports the request as `degraded`.

  Search stays lexical and honest; enabling semantic retrieval now requires
  doing the calibration the plan already mandated. Recorded as an explicit
  blocker below.
- **Regression test** PASS2-2 and PASS2-3 blocks, including the arithmetic table
  above as executable assertions.

---

### PASS2-3 — `relevanceFloor` is misleadingly named

- **Severity** P3
- **Observed** The config field reads as the §89.5 relevance floor but is a rank
  cutoff (see the table above). Left in place because the value is persisted in
  `search_benchmark_runs` and renaming it would invalidate stored run history for
  no behavioural gain. Documented in place instead, with the arithmetic spelled
  out and a pointer to where the real floor lives.

---

### PASS2-4 — Media batch limit counted joined rows, not courses

- **Severity** P2 — **regression introduced by PASS 1**
- **Observed** `listCoursesDueForMediaResolution` left-joined
  `course_categories` and `categories` to obtain a category slug for fallback
  classification, then applied `.limit(limit)`. A course in three categories
  consumed three rows of the budget, so `MEDIA_RESOLVE_LIMIT = 40` could mean as
  few as ~13 courses checked per run. The in-memory `byId` de-duplication hid
  the effect, making the run look correct while covering the catalog far more
  slowly than configured.
- **Fix** The limited query no longer joins categories; slugs come from the
  existing `mapCourseIdsToPrimaryCategorySlug` in a second query. The batch
  limit now means courses.
- **Regression test** PASS2-4 block.

---

### PASS2-5 — Expired coupon course returned one branch later

- **Severity** P1 — **incomplete PASS 1 fix, caught by its own regression test**
- **Observed** PASS 1 added an expiry filter to `listActive100OffOffers` and a
  guard in `daily-free.ts`. Both worked. But when the verified-offer branch then
  produced fewer than six items, the fallback branch ranked catalog rows and
  re-admitted the *same* course by `price_type = 'FREE_WITH_COUPON'`, labelled
  "cần coupon · chưa xác minh lại". The course left the surface through one door
  and came back through another.
- **Root cause** A `FREE_WITH_COUPON` course reaches the fallback precisely
  because it has no live verified offer — the coupon may have expired, been
  withdrawn, or never been checked. There is no evidence at that point that
  distinguishes those cases, so §126.4's "không còn ở Miễn phí hôm nay" cannot
  be satisfied by relabelling.
- **Fix** `FREE_WITH_COUPON` is excluded from the daily-free fallback entirely.
  The surface now contains only verified `ACTIVE_100_OFF` offers and
  `TEMPORARILY_FREE` courses.
- **Consequence, accepted** With coupon discovery off (the deploy default) and no
  `TEMPORARILY_FREE` courses, `/mien-phi-hom-nay` renders its honest Vietnamese
  empty state plus a CTA to durably free courses. That is the correct outcome:
  the page's claim is "verified free today", and an empty state is truthful where
  a populated one would not be.
- **Regression test** Three cases in the P1-1 block of
  `v13-wiring-regression.test.ts`, including "does not readmit the same course
  through the unverified fallback".

---

### PASS2-6 — `withDb` renders database failure as absence of data

- **Severity** P2 — **pre-existing, documented not changed**
- **Observed** `withDb(operation, fn, fallback)` catches every error, logs a
  warning, and returns the caller's fallback. Callers pass empty arrays and
  empty result objects. A database outage therefore renders "Chưa có ưu đãi miễn
  phí hôm nay" or "no results" — a confident factual claim — rather than an
  error state. The failure is logged, so it is observable, but the user-facing
  page is silently wrong.
- **Evidence** `src/lib/db-safe.ts` L9–17; ~40 call sites across public pages.
- **Why not changed now** Distinguishing "empty" from "failed" correctly means
  changing the contract at every call site and adding error states to every
  surface. That is a broad refactor with real regression risk, and it is not
  a v1.3/v1.3.1 requirement — the plans ask for graceful degradation, which this
  provides. Recorded as a remaining finding rather than remediated late in a
  validation run.

---

### PASS2-7 — Outbound click endpoints are not rate limited

- **Severity** P2 — **pre-existing, documented not changed**
- **Observed** `/course/[slug]/go` and `/go/affiliate` write a row per request
  (`recordOutboundClick`, `recordAffiliateClick`) with no rate limiting.
  `src/lib/rate-limit.ts` is applied only to admin login and watch creation.
  An unauthenticated client can inflate the North Star metric and generate
  unbounded database writes.
- **Mitigating** Tracking failure is already caught and never blocks the
  redirect, so this degrades analytics quality rather than availability. The
  existing limiter is in-memory and per-instance, so applying it here would give
  weak protection and a false sense of coverage.
- **Recommendation for a follow-up** durable rate limiting, sized against real
  traffic. Not attempted here: §85 has no threshold for it and inventing one
  would be a fabricated gate.

---

### PASS2-8 — Embedding daily token budget is declared but not enforced

- **Severity** P2 — **pre-existing**
- **Observed** `EMBEDDING_DAILY_BUDGET_TOKENS` is validated in `env.ts` and used
  to bound a batch, but there is no persisted daily counter, so the cap is
  per-run rather than per-day. §99.3 asks for a daily budget with "vượt budget →
  degrade, không lỗi".
- **Mitigating** Backfill is bounded per run, runs once daily on the cron, and
  query-time embedding goes through the durable cache. Actual spend is therefore
  bounded in practice by run frequency, not by the declared budget.
- **Status** Documented. `EMBEDDING_DAILY_BUDGET_USD` from §104 is absent
  entirely; USD reporting requires real invoice data and is a live-verification
  item.

---

## Part 3 — Adversarial scenario results

Behaviour traced through the code as it now stands.

| Scenario | Actual behaviour |
|---|---|
| Semantic subsystem unavailable, `FEATURE_HYBRID_SEARCH=true` | `searchSemantic` returns `degraded: true`; `searchHybrid` falls back to lexical, `retrievalMode: "LEXICAL"`, `degraded: true` persisted. No 500. |
| `RELEVANCE_FLOOR` unset with semantic flags on | Semantic path stays off, warning logged, request marked degraded, lexical results served. |
| Embedding dimension changed, old vectors present | `cosineSimilarity` returns 0 on length mismatch rather than throwing, so stale vectors cannot rank or crash. Version filter already excludes other `(model, version)` pairs. |
| Embedding provider unavailable | `createEmbeddingProviderFromEnv` returns null → `degraded: true` → lexical. |
| Query embedding times out | `Promise.race` at `EMBEDDING_QUERY_TIMEOUT_MS` → degraded → lexical. The losing promise is abandoned, not awaited. |
| Two coupon verification workers on the same offer | Both fetch and both write; last write wins, and the value written is derived from a fresh official fetch either way. `course_offers.offer_url` is unique so no duplicate row. Converges, not corrupts. |
| Two discovery runs find the same offer | Unique index on `coupon_candidates.offer_url` plus `onConflictDoNothing`; the loser counts a duplicate and continues. |
| Coupon source returns 500 Udemy links | Bounded by `COUPON_DISCOVERY_MAX_CANDIDATES_PER_RUN` and `COUPON_DISCOVERY_MAX_PAGES_PER_RUN`. |
| Coupon expires between discovery and click | Read-time expiry filter removes it from the surface at next render; the offer row keeps history. |
| Aggregator claims 100% off | Candidate is `DISCOVERED`; only a successful official fetch can promote it. Test asserts this. |
| Image host: 200 + `image/png` header, HTML body | Accepted as bytes — content is not sniffed. Stored/linked as an image and fails to render, falling back client-side. Bounded and not a security issue; noted as a fidelity limit. |
| Image redirects to an internal IP | Rejected before the hop is requested; `redirect_blocked`. |
| Image redirect loop | `too_many_redirects` after 3 hops. |
| Course `canonical_url` changes provider-side | Candidate matching by canonical URL misses, so the offer keeps `course_id: null` and cannot surface on daily-free (which requires a joined published course). Fails closed. |
| Admin retries the same bulk approve | `canApproveCandidate` rejects an already-`APPROVED` candidate; the duplicate-course guard rolls back and marks `DUPLICATE`. |
| `FEATURE_MEDIA_RESOLVER=true`, 10 000 courses | 40 courses per cron run, 4 runs/day, oldest-checked first, concurrency 4. Bounded; full coverage is slow by design rather than a provider hammer. |
| Hybrid search, `page=2` | Now returns fused results 13–24 with `totalPages` derived from the fused set. Was broken; see PASS2-1. |
| All AI/vector/coupon/media flags off | Lexical search, catalog, course detail all render. Daily-free shows its honest empty state. |
| Feature flag flipped while a worker runs | Flags are read per invocation; the in-flight run completes under the old value and the next run sees the new one. No partial-state writes. |

---

## Part 4 — Quality gate status after PASS 2 remediation

Reported in `docs/V1_3_V1_3_1_FINAL_VALIDATION.md` with the commands run.

## Final finding counts — PASS 2

| Severity | Found | Fixed | Documented / deferred |
|---|---|---|---|
| P0 | 0 | — | — |
| P1 | 3 (PASS2-1, PASS2-2, PASS2-5) | 3 | — |
| P2 | 4 (PASS2-4, PASS2-6, PASS2-7, PASS2-8) | 1 (PASS2-4) | 3 |
| P3 | 1 (PASS2-3) | 0 | 1 |

Two of the three P1s were defects in PASS 1's own remediation, which is the
result the two-pass structure is for. PASS2-5 was surfaced by a regression test
written during PASS 1 remediation rather than by re-reading the code.

## Blockers recorded

- **Semantic relevance floor cannot be calibrated locally.** §89.5 requires the
  threshold to come from graded relevance labels and §86.4 requires two
  independent annotators. `data/search-eval/v1/queries.json` carries no graded
  labels. Producing them is human work, not something this run may fabricate.
  Until then `RELEVANCE_FLOOR` stays empty and semantic/hybrid retrieval stays
  off by construction — which also means the §91 STOP 1 four-way benchmark and
  the +15% NDCG gate remain unevaluated.
- **Live coupon verification** cannot be exercised locally without hitting
  Udemy. Parser, state machine, expiry and duplicate handling are covered by
  deterministic fixtures; the HTML-evidence heuristics are not.
- **Real USD embedding cost** requires provider invoice data.
