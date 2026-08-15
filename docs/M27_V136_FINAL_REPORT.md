# v1.3.6 / M27 FINAL REPORT

**Status:** COMPLETE (ops + measurement capability)  
**Date:** 2026-08-15  
**Baseline:** v1.3.5 / M26  
**Commit / push / deploy / production mutation:** **NOT done** (per plan)

---

## 1. EXECUTIVE VERDICT

**Partially yes — operationally useful; not yet proven on live catalog growth or live CWV.**

Radar can now:

- Rank catalog gaps as `P0_GAP` … `P3_LOW` from coverage + demand (not affiliate)
- Recommend bounded discovery from **enabled** `discovery_queries` only
- Dry-run a plan (`mutatesDatabase: false`) before operator execution
- Diagnose FAILING / DEGRADED / LOW_YIELD with failure classes (including `LOW_YIELD_BY_NATURE`)
- Snapshot T0 catalog health and compute T1 delta when an operator cycle exists
- Connect unmet / zero-result demand → recommendation → plan → confirm-run (no auto-publish)

What this session **could not** prove without credentials / preview:

- Live EMPTY/THIN counts or which topics actually closed
- Which providers fail in production with real evidence for a parser fix
- Production-like Lighthouse / TTFB / LCP / CLS / INP numbers

**M27 success here = proof of the operating loop + quality gates, not fabricated growth or green CWV scores.**

---

## 2. RUNTIME ACCESS

| Capability | Classification | Evidence |
|---|---|---|
| Neon DB | **NOT_AVAILABLE** | No `.env` / `.env.local` (only `.env.example`) |
| Vercel preview | **NOT_AVAILABLE** | No preview URL / deploy in session |
| R2 | **NOT_AVAILABLE** | No object-storage credentials in env |
| Provider discovery (live) | **REQUIRES_OPERATOR** | Engine + Admin run exist; needs DB + search keys |
| Lighthouse / browser | **LOCAL_AVAILABLE** (tooling) / **NOT_AVAILABLE** (measured) | Runbook prepared; no Lighthouse run executed |
| Cron simulation | **REQUIRES_OPERATOR** | Existing cron routes; not exercised live |
| Local production build | **LOCAL_AVAILABLE** | `npm run build` **PASS** |

Do not fabricate access.

---

## 3. CATALOG BASELINE

| Metric | Value |
|---|---|
| published eligible / EMPTY / THIN / HEALTHY / STRONG | **NOT MEASURED — LIVE DB REQUIRED** |
| Capture API | `captureCatalogGrowthSnapshot(db, "T0")` |
| Admin surface | `/admin/coverage` loads T0 snapshot when DB connected |

Mark: **MEASURED (code + tests)** / **NOT MEASURED (live Neon)**

---

## 4. PRIORITY GAPS

Live top gaps: **NOT MEASURED — LIVE DB REQUIRED**.

Classification (transparent, not hard-coded topics):

| Priority | Rule (summary) |
|---|---|
| `P0_GAP` | `EMPTY` (any demand), especially HIGH/MEDIUM demand |
| `P1_HIGH` | `THIN` |
| `P2_NORMAL` | `HEALTHY` + normal cadence / degraded-provider caveats |
| `P3_LOW` | `STRONG` |

Demand bands: `NONE` / `LOW` (≤2) / `MEDIUM` (≤8) / `HIGH` (>8) searches / 30d mapped to category.

Implementation: `src/domain/coverage/growth-priority.ts` + `listDiscoveryRecommendations`.

---

## 5. DISCOVERY RECOMMENDATIONS

When DB is available, `/admin/coverage` → **Đề xuất bổ sung catalog** shows:

| Field | Source |
|---|---|
| Ưu tiên | `classifyGrowthPriority` |
| Chủ đề | category coverage |
| Độ phủ | EMPTY/THIN/… + published eligible |
| Nhu cầu | unmet intent mapped to category |
| Provider đề xuất | enabled discovery queries only |
| Yield / health | provider effectiveness |
| Suggested queries + budget | bounded by priority (P0 ≤5 queries ×10) |

Actions:

- **[Xem kế hoạch]** → `GET /api/admin/discovery/plan?category=` (dry-run)
- **[Chạy Discovery]** → `/admin/discovery?category=…` with confirm step

Dry-run guarantees in payload: `mutatesDatabase: false`, `createsCourses: false`, `publishesCourses: false`.

---

## 6. PROVIDER HEALTH

Live matrix: **NOT MEASURED — LIVE DB REQUIRED**.

Capability (from M26 + M27 diagnostics):

| Health | Diagnostic emphasis |
|---|---|
| HEALTHY | Keep cadence |
| DEGRADED | Scoped manual confirm; schedule / network |
| LOW_YIELD | May be `DUPLICATE_HEAVY`, `NO_COURSE_SIGNAL`, or **`LOW_YIELD_BY_NATURE`** |
| FAILING | `NETWORK` / `API_CHANGED` style actions — **no robots/auth bypass** |

Admin: `/admin/coverage` provider diagnostics table via `diagnoseProviders`.

---

## 7. PROVIDER FIXES

| Fix | Status |
|---|---|
| Parser / selector / URL / timeout regression | **None applied** — no live failure evidence without DB/provider runs |
| Policy / robots / auth bypass | **Not done** (forbidden) |
| Low-yield treated as bug | **Rejected by design** → `LOW_YIELD_BY_NATURE` / reduce priority |

Code delivered: diagnosis + recommended actions only.

---

## 8. DISCOVERY YIELD

| Item | Status |
|---|---|
| Yield math | `computeYieldMetrics` — unique / valid / duplicate / fetch / analysis |
| Approval rate | Only when `approved != null` — never faked |
| Fixture benchmark | `YIELD_FIXTURE_SAMPLES` + unit tests |
| Live BEFORE / AFTER for a fixed provider | **NOT AVAILABLE** (no provider fix + no comparable live sample) |

---

## 9. ZERO-RESULT CLOSURE

Derived status (no new schema): `OPEN` → `DISCOVERY_PLANNED` → `CANDIDATES_FOUND` → `COVERAGE_IMPROVED`

```text
Search demand → ZERO/LOW results → coverage gap → recommendation
  → dry-run plan → operator confirm run → candidate review → publish
  → search results improve
```

Final publish remains human / existing approval. Live example with real “kubernetes” counts: **NOT MEASURED**.

---

## 10. CATALOG GROWTH

| Snapshot | Status |
|---|---|
| T0 mechanism | **EXISTS** (`captureCatalogGrowthSnapshot`) |
| T0 live values | **NOT MEASURED — LIVE DB REQUIRED** |
| T1 | **NOT AVAILABLE** — no operator discovery + review cycle in this session |
| Fake growth | **Not performed** |
| Auto-publish | **Not added** |

`diffCatalogSnapshots` supports published-eligible delta, EMPTY/THIN closed, zero-result delta — for use after a real T1.

---

## 11. DATA QUALITY

| Area | Status |
|---|---|
| Truth eligibility | Unchanged — discovery does not lower Truth for metrics |
| Freshness / image / duplicates | Visible via M26 baseline + queues when DB live |
| Source health | Provider effectiveness + diagnostics |
| Live rates | **NOT MEASURED** |

---

## 12. PERFORMANCE BENCHMARK

Environment mark for all routes below: **NOT_AVAILABLE** (no preview URL; local `next start` + Lighthouse not executed in this session).

| Route | TTFB | FCP | LCP | CLS | TBT/INP | Lighthouse | Env |
|---|---|---|---|---|---|---|---|
| Homepage | — | — | — | — | — | — | NOT_AVAILABLE |
| Search | — | — | — | — | — | — | NOT_AVAILABLE |
| Miễn phí hôm nay | — | — | — | — | — | — | NOT_AVAILABLE |
| Category | — | — | — | — | — | — | NOT_AVAILABLE |
| Topic | — | — | — | — | — | — | NOT_AVAILABLE |
| Course detail | — | — | — | — | — | — | NOT_AVAILABLE |

Classification: **NOT_MEASURED** for CWV; build First Load JS observed only (e.g. `/[locale]` ~141 kB) — **not** a CWV claim.

Operator runbook: `docs/M27_PERFORMANCE_RUNBOOK.md`.

---

## 13. NAVIGATION UX

| Check | Result |
|---|---|
| Immediate click feedback | Code path: NextTopLoader (M25) — **NOT re-validated in browser this session** |
| Loading / skeleton | Home + catalog + daily-free loading from M25 — **code present** |
| Blank flash / layout / image jump | **NOT_MEASURED** live |
| Scroll restoration / transition feel | **NOT_MEASURED** live |

No M27.9 navigation rewrite (no measured P0).

---

## 14. PERFORMANCE FIXES

**None in M27.**

M27.9 only runs on clear P0/P1 from M27.8. M27.8 did not produce measured P0/P1 → no BEFORE/AFTER delta.

M25 branding/cache/skeleton/font work remains the last measured code-side perf delta; live CWV still open.

---

## 15. R2 VALIDATION

| Check | Status |
|---|---|
| Managed upload / public URL / fallback / metadata / orphan | **NOT VALIDATED LIVE** |
| Bulk migration | **Not run** (forbidden) |

Not a blocker for M27 catalog ops code.

---

## 16. COST OBSERVATIONS

No dollar figures (no billing dashboards in session).

Likely future bottlenecks (qualitative, from architecture):

1. **Discovery fetches + verification jobs** as catalog/query volume grows  
2. **Neon** connection/compute under public + Admin analytics windows  
3. **Vercel** serverless duration on dynamic catalog/search routes  
4. **R2** only after live media migration scale  
5. **Embeddings / AI** if Semantic Search is expanded later (explicitly out of M27)

---

## 17. SECURITY / PRIVACY

| Check | Result |
|---|---|
| Admin RBAC on dry-run plan API | ADMIN / EDITOR only (`/api/admin/discovery/plan`) |
| Truth / coupon / affiliate isolation | Not weakened |
| Discovery diagnostics secrets | Diagnostics use rates + reason classes — no credentials in Admin payload |
| SSRF / R2 secrets / search privacy | No M27 change that expands secret surface |
| Production mutation | None automatic |

---

## 18. CHANGED FILES

### catalog / coverage
- `src/domain/coverage/growth-priority.ts`
- `src/domain/coverage/discovery-recommendations.ts`
- `src/domain/coverage/growth-snapshot.ts`
- `src/domain/coverage/gap-closure.ts`
- `src/domain/coverage/discovery-yield.ts`
- `src/domain/coverage/provider-diagnostics.ts`
- (+ M26 coverage stack already present under `src/domain/coverage/*`)

### discovery
- `src/app/api/admin/discovery/plan/route.ts` *(new)*
- `src/components/admin/discovery-plan-button.tsx` *(new)*
- `src/components/admin/discovery-run-form.tsx` (confirm + URL seeds)
- `src/app/admin/discovery/page.tsx`
- M26-related: `discovery-engine.ts`, `discovery-query-service.ts`, `candidate-service.ts` (adaptive / rejection wiring)

### provider
- Diagnostics only (`provider-diagnostics.ts`) — no adapter bypass

### performance
- `docs/M27_PERFORMANCE_RUNBOOK.md` *(new)* — no code rewrite in M27.9

### admin
- `src/app/admin/coverage/page.tsx` (recommendations + plan + diagnostics + T0)
- `src/lib/i18n/admin/{vi,en,types}.ts`
- `src/components/admin/admin-shell.tsx` (nav as needed for demand)

### tests
- `src/test/m27-growth.test.ts` *(new)*
- `src/test/m26-coverage.test.ts` (prior)

### docs
- `docs/M27_V136_FINAL_REPORT.md` *(this file)*
- `docs/M27_PERFORMANCE_RUNBOOK.md`
- `docs/M26_V135_FINAL_REPORT.md` (prior, still untracked if not committed)

---

## 19. QUALITY GATES

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run test` | **PASS** — 80 files / **660** tests |
| `npm run build` | **PASS** |
| Migration validation | **N/A** — no new M27 schema / migration |

---

## 20. P0 / P1 / P2

### P0
- **0** in code/gates for this milestone.

### P1
- **Live CWV still open** (carried from M25/M26) — **ACCEPTED_RISK for M27 code freeze**: blocked on preview/credentials; runbook exists.  
- **Live catalog T0/T1 not executed** — **ACCEPTED_RISK**: mechanism shipped; requires operator DB + discovery + review.

### P2
- Provider live RCA / selective parser fixes after real FAILING evidence  
- Optional Admin gap-status column using `deriveGapClosureStatus` (logic exists; UI may remain recommendation-centric)  
- Field RUM / INP later

---

## 21. ACCEPTED RISKS

1. **NOT_MEASURED** production-like performance — do not claim LCP/TTFB pass.  
2. **T1 NOT AVAILABLE** — do not claim catalog growth.  
3. **R2 NOT VALIDATED LIVE**.  
4. No provider code fix without live regression proof (avoids speculative crawler churn).

---

## 22. MANUAL OPERATOR STEPS

1. Provide safe `.env` (Neon) or open existing preview — **no auto-deploy from agent**.  
2. Open `/admin/coverage` — record real T0 (EMPTY/THIN, demand, provider health).  
3. Use **Xem kế hoạch** on P0/P1 rows → confirm scope → **Chạy Discovery** with confirm UI.  
4. Review candidates → approve only Truth-eligible → capture T1 via same snapshot helper.  
5. Run `docs/M27_PERFORMANCE_RUNBOOK.md` against PREVIEW or LOCAL_PROD; paste scores into section 12.  
6. Optionally validate one R2 upload when credentials exist.  
7. Commit/push only when explicitly requested.

---

## 23. NOT DONE

- Live Neon catalog numbers / live provider failure matrix  
- Production or preview Lighthouse / TTFB / LCP / CLS / INP  
- Operator discovery execution + T1 improvement proof  
- Live R2 validation  
- Provider adapter bugfixes (no evidence)  
- M27.9 targeted perf code changes  
- Auto-publish, Truth relaxation, bulk catalog import  
- Feature expansions listed in §26 of the plan  

---

## 24. V1.3.X CLOSURE DECISION

```text
READY_AFTER_SMALL_FIXES
```

**Why not READY_FOR_V1.4 yet**

- Catalog growth usefulness is **wired** but **not proven** on realistic data (T1 missing).  
- Production-like performance finding from M25/M26 remains **NOT_MEASURED**.  
- Provider yield diagnosis is ready; live FAILING providers not yet triaged with evidence.

**Why not NOT_READY**

- M26+M27 ops loop is complete in code.  
- Invariants preserved; gates green; dry-run + confirm-run prevent silent mutation.  
- Remaining work is **operator measurement + scoped fixes**, not another architecture milestone.

After operator T0→discovery→T1 and one PREVIEW Lighthouse pass (or explicit ACCEPTED_RISK on CWV), v1.3.x can move to READY_FOR_V1.4.

---

## 25. NEXT 3 PRIORITIES

1. **Connect Neon/preview → run P0_GAP recommendations** (dry-run → confirm → review → publish) and capture **T1**.  
2. **Execute M27 performance runbook** on preview/LOCAL_PROD; fix only measured P0/P1.  
3. **Triage FAILING/LOW_YIELD providers** with live diagnostics; fix only clear technical regressions; mark natural low yield and reduce priority.

---

## 26. DO NOT BUILD NEXT

- Learning Path v2  
- Compare v2  
- Tracker / Alerts expansion  
- Affiliate / Shopee automation expansion  
- Semantic Search v2 / new embedding model  
- AI crawler / AI recommendations / chatbot  
- Community / gamification / CMS / mobile app  
- Large redesign  
- Redis-by-default / microservices  
- Auto-publish or Truth lowering to inflate coverage  

---

**STOP.** Do not commit / push / deploy / mutate production without explicit operator action.
