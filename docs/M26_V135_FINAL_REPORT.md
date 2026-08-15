# v1.3.5 / M26 FINAL REPORT

**Status:** COMPLETE  
**Date:** 2026-08-15  
**Baseline:** v1.3.4 / M25  
**Commit / push / deploy:** **NOT done** (per plan)

---

## 1. EXECUTIVE SUMMARY

**Yes — M26 improves Radar’s core discovery operation at the ops layer.**

Operators can now answer, with evidence from live queries (when DB is connected):

- What published Truth-eligible content exists by category/provider  
- What is EMPTY / THIN  
- Where candidates are lost (funnel + failure reasons)  
- Which providers are FAILING / LOW_YIELD / DEGRADED  
- What users search for that returns zero/low results (privacy-safe aggregates)  
- What to fix next (actionable work queues)

M26 does **not** invent auto-publish, does **not** weaken Truth, and does **not** expand Learning Paths / Compare / Semantic / Affiliate.

Live catalog counts in this session: **NOT MEASURED — LIVE DB REQUIRED**. Capability to measure is shipped.

---

## 2. BASELINE

| Metric | Value |
|---|---|
| total / published / draft / archived | **NOT MEASURED — LIVE DB REQUIRED** (API: `getCatalogBaseline`) |
| by domain/category/topic/provider | Measurable via `listCategoryCoverage` / `listTopicCoverage` / `listProviderCoverage` |
| freshness (Truth &lt; 30d) | Included in baseline + stale-truth work queue |
| image coverage | OK+FALLBACK rate on published; per-provider via `getImageCoverageByProvider` |

Mark: **MEASURED (code)** / **NOT MEASURED (live Neon)**

---

## 3. COVERAGE

Model: `src/config/coverage-thresholds.ts` + `classifyCoverageCount`

| Status | Rule (defaults) |
|---|---|
| EMPTY | published eligible ≤ 0 |
| THIN | ≤ 4 |
| HEALTHY | ≤ 14 |
| STRONG | &gt; 14 |

Primary count = **PUBLISHED + Truth-eligible** (`isEligibleForFreeLists`), not drafts.

Admin: `/admin/coverage` (“Độ phủ khóa học”) — summary, matrix, drill-down links to courses / candidates / discovery.

---

## 4. DISCOVERY FUNNEL

Actual stages (repository terms):

```text
Search result
 → ingest (CREATED | DUPLICATE | INVALID)  [INVALID/DUPLICATE → discovery_rejections]
 → DISCOVERED
 → FETCHED
 → ANALYZED / READY_FOR_REVIEW
 → APPROVED (+ course PUBLISHED)
 | REJECTED | INVALID | DUPLICATE | ERROR | EXPIRED_UNREVIEWED
```

Post-publish Truth verify remains `/api/cron/verify` — **not** a candidate stage (documented on Admin UI).

Funnel snapshot: `getDiscoveryFunnelSnapshot` (live status counts + pre-ingest rejects + discovery→APPROVED rate in window).

---

## 5. FAILURE REASONS

Taxonomy: `classifyDiscoveryFailureReason` →  
`DUPLICATE | INVALID_URL | NO_COURSE_SIGNAL | FETCH_FAILED | AUTO_REJECT | …`

Pre-ingest rejects now **persist** to existing `discovery_rejections` (was unused).

Top reasons: Admin coverage panel (30d window). Historical bulk before M26: incomplete by design.

---

## 6. PROVIDER EFFECTIVENESS

`listProviderEffectiveness`:

- query success/failure, candidate totals, APPROVED yield, duplicate rate  
- health: HEALTHY / DEGRADED / LOW_YIELD / FAILING / UNKNOWN  
- recommendation text — **no auto-disable**

---

## 7. UNMET USER INTENT

`/admin/discovery/demand` (“Nhu cầu chưa đáp ứng”)

- Aggregates from existing `search_queries` only  
- ZERO_RESULT / LOW_RESULT (≤2) / HEALTHY  
- Stores/shows hash + normalized query + counts — **no email/IP/fingerprint**  
- Deterministic `normalizeDemandQuery` (no LLM merge)

---

## 8. ADMIN OPERATIONS

| Surface | Change |
|---|---|
| `/admin/coverage` | Catalog health, work queues, funnel, failures, matrix, providers |
| `/admin/discovery/demand` | **New** unmet-intent table |
| Nav | Coverage label → “Độ phủ khóa học”; demand under Discovery |

Work queues link to existing corrective UIs (media quality, candidates, discovery, coverage anchors).

---

## 9. DISCOVERY PRIORITY

Conservative:

1. Interleave prefers EMPTY/THIN categories when coverage map loads  
2. After each query success: write `junkRate`; backoff **24→36→48h** for medium/high junk (never unbounded crawl)  
3. Failure backoff remains 6h  

Affiliate revenue **not** used.

---

## 10. DATA QUALITY

| Signal | Where |
|---|---|
| Image missing/broken | Work queue → `/admin/media-quality` |
| Stale Truth (&gt;30d or null) | Work queue → courses |
| Duplicates | Failure reason + provider LOW_YIELD |
| Freshness | Baseline freshVerificationRate30d |
| Source health | Provider FAILING / DEGRADED |

No opaque “AI quality score”.

---

## 11. PERFORMANCE VALIDATION (M25)

| Item | Result |
|---|---|
| Lighthouse mobile | **NOT AVAILABLE** — not run (avoid installing heavy tooling in-session; no staging URL mutated) |
| Live TTFB/LCP/CLS/INP | **NOT AVAILABLE** — no production-like HTTP measurement against Neon in this session |
| Code regression check | No M25 branding cache / loading / next/font paths reverted |
| Build First Load | Shared ~103 kB (same order as M25) |

**Manual step:** run Lighthouse on preview after deploy for `/vi`, `/vi/search`, one course detail.

No performance rewrite in M26 (per plan).

---

## 12. PRIVACY & SECURITY

- Demand analytics: aggregate only  
- Discovery rejection URLs truncated; no credentials logged  
- Admin pages remain session-gated (`getSession`)  
- Truth / coupon / ranking / affiliate isolation unchanged  

---

## 13. MIGRATIONS

**None.** Extended existing tables (`discovery_rejections` writes, `discovery_queries.junkRate` writer, read-time aggregates).

---

## 14. CHANGED FILES

### coverage
- `src/config/coverage-thresholds.ts`
- `src/domain/coverage/classify-coverage.ts`
- `src/domain/coverage/catalog-metrics.ts`
- `src/domain/coverage/discovery-funnel.ts`
- `src/domain/coverage/failure-reasons.ts`
- `src/domain/coverage/provider-effectiveness.ts`
- `src/domain/coverage/unmet-intent.ts`
- `src/domain/coverage/work-queues.ts`

### discovery
- `src/domain/candidate/candidate-service.ts` (wire rejections)
- `src/domain/discovery/discovery-engine.ts` (junkRate + queryId)
- `src/domain/discovery/discovery-query-service.ts` (priority interleave + adaptive schedule)
- `src/domain/discovery/discovery-engine.test.ts`

### analytics / admin
- `src/app/admin/coverage/page.tsx`
- `src/app/admin/discovery/demand/page.tsx`
- `src/components/admin/admin-shell.tsx`
- `src/lib/i18n/admin/{types,vi,en}.ts`

### tests
- `src/test/m26-coverage.test.ts`

### docs
- `docs/M26_V135_FINAL_REPORT.md`

---

## 15. QUALITY GATES

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run test` | **PASS** — 79 files / **653** tests |
| `npm run build` | **PASS** |
| Migration | **N/A** (no schema change) |

---

## 16. P0 / P1 / P2 FINDINGS

### P0
None.

### P1
- Live catalog numbers still require connected DB / preview  
- CWV validation still needs human Lighthouse on staging  

### P2
- Open-candidate-by-category join is approximate (query+provider match)  
- `discovery_category_stats.verifiedCount` still means “bumped on approve” historically — UI now prefers live eligible counts  
- Topic coverage depends on `topic_tags` population  

### ACCEPTED_RISK
- Pre-M26 rejection history empty until new runs  
- Adaptive schedule only lengthens cadence (never shorter than 24h success default)  

---

## 17. ACCEPTED RISKS

See §16. No Truth lowering. No auto-publish.

---

## 18. MANUAL PRODUCTION STEPS

1. Deploy preview (when ready) — do not flip new flags (none added)  
2. Open `/admin/coverage` — confirm matrix + queues with real data  
3. Open `/admin/discovery/demand` after some public searches  
4. Run one scoped Admin discovery → confirm `discovery_rejections` + `junk_rate` update  
5. Lighthouse mobile on homepage / search / course  

---

## 19. NOT DONE (deferred)

- Auto-seeding discovery queries from unmet intent (recommend only)  
- New `discovery_runs` table  
- Redis / microservices  
- Semantic Search v2 / Learning Path / Compare / Tracker / Affiliate expansion  
- Live CWV numbers in this report  
- Bulk catalog import  

---

## 20. PRODUCT VERDICT

> Is FreeLearn Radar now better at its core job of finding trustworthy free learning opportunities?

**Yes, operationally.** The product can measure gaps and steer discovery with evidence. **Catalog size itself** still depends on running discovery + human approve under Truth — M26 does not fake coverage by publishing junk.

### If only 3 things after M26:

1. **Run coverage-driven discovery** on EMPTY/THIN + top unmet queries; approve carefully  
2. **Measure CWV on staging** (close M25 loop)  
3. **Fix FAILING/LOW_YIELD providers** called out by the effectiveness table  

### What should NOT be built next:

Learning Path v2, Compare v2, Tracker/Alerts scale, Affiliate expansion, Semantic/AI crawler, chatbot, redesign, Redis-by-default.

---

**STOP.** Do not commit / push / deploy.
