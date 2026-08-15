# v1.3.4 / M25 FINAL REPORT

**Status:** COMPLETE (audit + measured fixes)  
**Date:** 2026-08-15  
**Baseline:** v1.3.3 / M24 (object storage) + prior product stack  
**Commit / push / deploy:** **NOT done** (per plan)

Ghi chú: phản hồi sản phẩm bằng **Tiếng Việt** ở mục Executive Verdict và khuyến nghị cuối.

---

## 1. EXECUTIVE VERDICT

**YES, BUT…**

FreeLearn Radar vẫn đúng hướng: **radar khóa học miễn phí đã kiểm chứng** (Truth + discovery + outbound). Core value rõ hơn hầu hết “course aggregator”.

Nhưng sản phẩm đang **nặng hơn giá trị người dùng cảm nhận được**:

- Homepage / nav chất quá nhiều hệ thống (coupon, path, tracker, compare, affiliate, interests…).
- Catalog còn mỏng → cảm giác “chậm / trống” một phần là **product**, không chỉ kỹ thuật.
- Cảm giác lag chủ yếu đến từ **request path động + branding resolve trùng lặp + thiếu loading route**, không phải thiếu animation.

**Không pivot.** Thu hẹp bề mặt, làm nóng đường đi chính, phủ catalog — trước khi mở feature mới.

---

## 2. PRODUCT SCORECARD

| Dimension | Status | Evidence | Recommendation |
|---|---|---|---|
| Value Proposition | **YELLOW** | Core = free + verified courses; homepage còn nhiều CTA cạnh tranh | Giữ Truth + discovery; cắt distraction trên first viewport |
| Discovery | **YELLOW** | Funnel rõ nhưng catalog mỏng; nhiều lối vào | Ưu tiên coverage domains cốt lõi |
| Truth | **GREEN** | Semantics + verification + outbound policies còn nguyên | Không nới để “nhanh hơn” |
| Data Quality | **YELLOW** | Pipeline mạnh; coverage chưa đủ để “wow” | Operational discovery fill, không thêm UI |
| UX | **YELLOW→GREEN** | M22 ổn; M25 thêm skeleton home/daily-free + next/font | Tiếp tục đơn giản hóa homepage (không redesign lớn) |
| Performance | **YELLOW** | P0 branding/DB hot-path đã sửa (code-evidence); CWV live **NOT AVAILABLE** | Đo Lighthouse trên staging sau deploy |
| Operability | **GREEN** | Admin + cron + flags + audit | Giữ; đừng mở Admin mới trước public P1 |
| SEO | **GREEN** | Locale routes, topic landings, sitemap | Giữ; content/coverage > schema mới |
| Monetization | **YELLOW** | Affiliate + coupons sẵn; không được trộn ranking | DEFER expand; đo conversion khi traffic ổn |
| Maintainability | **YELLOW** | Nhiều subsystem; M24/M25 thêm abstraction có lý do | Freeze feature surface |
| Cost | **YELLOW** | Neon + optional R2 + AI search paths | Cache hot path; tránh Redis/microservice |

---

## 3. PRODUCT DIRECTION

### Đang làm tốt
- Truth / free-certificate / coupon ACTIVE_100_OFF semantics
- Discovery → card → detail → outbound
- Vietnamese-only product UI
- Admin RBAC + audit

### Đang over-engineered / loãng
- Learning Paths, Compare, Tracker/Alerts (flag-gated, ít traffic giả định)
- Semantic/hybrid search complexity so với catalog size
- Homepage sections chồng chéo (daily free + durable + verified + cert + short + for-you + providers + monthly)

### Nên đơn giản hóa (không xóa code ở M25)
- Homepage: 1 hero CTA + 2–3 section có data thật
- Nav: bớt mục “thử nghiệm”
- Affiliate: giữ Góc học tập; không mở SKU mới

### KHÔNG xây tiếp
- Semantic search expansion / AI parser nâng cấp
- Learning path content packs
- Compare UX v2
- Tracker/alerts scale (email infra)
- Affiliate marketplace expansion
- Redis / microservices / redesign lại toàn site

### Top 3 việc tiếp theo
1. **Catalog coverage** (domains cốt lõi đủ dày để discovery có ý nghĩa)
2. **Homepage / nav simplify** (giảm quyết định, giữ funnel chính)
3. **Đo CWV trên staging** + ISR/revalidate cho dữ liệu slow-changing (sau khi flag kill-switch cho phép)

---

## FEATURE CLASSIFICATION (M25.0 / M25.10)

| System | Class | Color |
|---|---|---|
| Discovery | **KEEP** | GREEN/YELLOW |
| Truth | **KEEP** | GREEN |
| Coupon | **KEEP** (ops, không expand UI) | YELLOW |
| Search lexical | **KEEP** | GREEN |
| Semantic / hybrid | **DEFER** expand | YELLOW |
| Learning Path | **DEFER** | RED product ROI |
| Similar Courses | **KEEP** light | YELLOW |
| Compare | **DEFER** | RED |
| Tracker / Alerts | **DEFER** | RED |
| Affiliate | **SIMPLIFY** / don’t expand | YELLOW |
| Media / object storage | **KEEP** | GREEN |
| Branding | **KEEP** | GREEN |
| Admin | **KEEP** | GREEN |
| SEO landings | **KEEP** | GREEN |

---

## 4. PERFORMANCE ROOT CAUSES

| Pri | Cause | Evidence class |
|---|---|---|
| **P0** | Branding `resolveBranding` gọi nhiều lần / request (root metadata + home metadata + home body + SiteHeader); trong resolve còn lookup asset tuần tự | **MEASURED (code path)** |
| **P0** | Homepage `force-dynamic` + ~9 `withDb` song song (gồm 2 `queryCatalog` dư) | **MEASURED (code path)** |
| **P1** | Thiếu `loading.tsx` cho `/mien-phi-hom-nay`; locale loading generic → blank/abrupt | **MEASURED (repo)** |
| **P1** | Font qua Google CSS `<link>` (render-blocking, lint) | **MEASURED (repo)** |
| **P2** | Search `searchParams` → dynamic; hybrid/semantic trên query | **ESTIMATED** |
| **P2** | Homepage vẫn force-dynamic vì feature flags (kill-switch test) | **MEASURED (test + code)** |
| **P3** | Admin aggregates; secondary surfaces | **ESTIMATED** |

---

## 5. BASELINE (BEFORE)

Environment: no live Neon latency / no Lighthouse in-session.

| Route | TTFB | LCP | CLS | Server | DB ops (code) | Cache | Main bottleneck |
|---|---|---|---|---|---|---|---|
| `/[locale]` | **N/A** | **N/A** | **N/A** | force-dynamic | ~9 `withDb` + branding×N sequential assets | dynamic | branding dup + catalog queries |
| `/search` | **N/A** | **N/A** | **N/A** | searchParams | catalog (+ optional hybrid) | dynamic | query + optional semantic |
| course detail | **N/A** | **N/A** | **N/A** | dynamic | course + related | dynamic | OK-ish |
| Miễn phí hôm nay | **N/A** | **N/A** | **N/A** | force-dynamic | daily deals | dynamic | no loading UI |
| category/topic | **N/A** | **N/A** | **N/A** | params/filters | catalog | mixed (topic `revalidate=3600`) | filters |
| `/admin` | **N/A** | **N/A** | **N/A** | force-dynamic | aggregates | dynamic | acceptable |

**Client JS (build AFTER, proxy for baseline size):** First Load shared **103 kB**; `/[locale]` **141 kB** total. (Comparable pre-M25 not captured.)

Legend: **MEASURED** / **ESTIMATED** / **NOT AVAILABLE**

---

## 6. SERVER / DB CHANGES

1. **`getResolvedBranding`** — `React.cache` (1×/request) + `unstable_cache` 60s tag `site-branding`
2. **`resolveBranding`** — batch managed assets (`inArray`) + `listSiteAssets` thay vì 4–8 round-trip tuần tự
3. **Homepage** — bỏ `home.freeCert` / `home.short` `queryCatalog`; derive từ published list
4. Call sites: `layout`, `SiteHeader`, home metadata/body → `getResolvedBranding`
5. Admin branding mutation vẫn `revalidatePublicBranding()` **+** `revalidateTag(site-branding)`

**Trade-off accepted:** free-cert / short teaser trên home lấy từ top published pool (60), không phải full catalog rank — trang chuyên dụng vẫn query đầy đủ.

---

## 7. CACHE / RENDERING CHANGES

| Route / data | Before | After |
|---|---|---|
| Branding | Uncached DB mỗi caller | Tag cache 60s + request dedupe |
| Homepage | force-dynamic (flags) | **Unchanged** force-dynamic (flag kill-switch invariant) |
| Topic landings | `revalidate=3600` | Unchanged |
| Taxonomy-like | Often live | Prefer cache on branding only this milestone |

**Not done (intentional):** chuyển homepage sang ISR — sẽ fail `feature-flag-runtime.test.ts` nếu bỏ `force-dynamic`/`revalidate=0` trong khi đọc `FEATURE_*`.

---

## 8. NAVIGATION UX

| Item | Change |
|---|---|
| `NextTopLoader` | Đã có — giữ |
| Soft GET filters | `SoftGetForm` + toploader router — giữ |
| `[locale]/loading.tsx` | `variant="home"` skeleton |
| `mien-phi-hom-nay/loading.tsx` | **mới** — catalog skeleton |
| `PublicPageLoading` | thêm `HomeSkeleton` |

Mục tiêu: click → feedback nhanh (progress + skeleton), không blank flash.

---

## 9. FRONTEND PERFORMANCE

| Area | Change |
|---|---|
| Fonts | `next/font` Manrope + Fraunces; bỏ Google CSS link |
| Images | Không redesign; priority chỉ above-fold (đã có `priorityCount`) |
| Client JS | Homepage First Load ~141 kB (build) — không thêm lib animation |
| Hydration | Không chuyển interactive cần thiết sang server sai |

---

## 10. SEARCH PERFORMANCE

- Lexical-first + hybrid khi flag/query — **không đổi thuật toán**
- Không weaken relevance
- Filter transitions: SoftGetForm + catalog `loading.tsx`
- Semantic latency: **NOT MEASURED** live; không tune timeout trong M25

---

## 11. ADMIN PERFORMANCE

Không ưu tiên tối ưu Admin trước public P0/P1. Admin vẫn `force-dynamic`. Media-storage / aggregates để nguyên.

---

## 12. MOBILE REVIEW

| Check | Result |
|---|---|
| Skeleton approx layout | Home + catalog — yes |
| Blank daily-free | Fixed via loading.tsx |
| Network throttle / device lab | **NOT AVAILABLE** in session |
| Prefer reduced motion | Skeleton pulse only; no heavy page motion added |

---

## 13. BEFORE / AFTER TABLE

| Metric | Before | After | Delta |
|---|---|---|---|
| Homepage parallel `withDb` named ops | 9 (incl freeCert/short/branding) | **6** data + branding via cache helper | **−3 catalog/branding DB entrypoints** |
| Branding resolves / public request | up to **4×** full resolve | **1×** request-scoped (+ 60s cross-request) | **~−75% resolve calls** |
| Branding SQL style | sequential asset lookups | batched | fewer round trips |
| Daily-free loading UI | missing | present | UX |
| Font loading | Google CSS link | `next/font` | remove render-blocking CSS |
| TTFB / LCP / CLS live | N/A | N/A | **not claimed** |
| First Load JS `/[locale]` | N/A | 141 kB | build observation only |

---

## 14. CORE WEB VITALS

| Vital | Before | After | Notes |
|---|---|---|---|
| LCP | NOT AVAILABLE | NOT AVAILABLE | Need staging Lighthouse |
| CLS | NOT AVAILABLE | NOT AVAILABLE | Font swap mitigated via next/font |
| INP | NOT AVAILABLE | NOT AVAILABLE | |
| Warm TTFB | NOT AVAILABLE | ESTIMATED improved on branding-hot paths | Neon cold starts still possible |

Targets remain: LCP ≤2.5s mobile, CLS ≤0.1, INP ≤200ms, warm TTFB ≤500ms — **validate in production/staging**, do not fake.

---

## 15. CHANGED FILES (by domain)

### Branding / cache
- `src/domain/branding/get-resolved-branding.ts` *(new)*
- `src/domain/branding/site-branding.ts`
- `src/domain/branding/revalidate-public.ts`
- `src/db/repositories/site-branding-repository.ts`
- `src/app/layout.tsx`
- `src/components/public/site-header.tsx`
- `src/app/[locale]/page.tsx`

### Loading UX
- `src/components/public/public-page-loading.tsx`
- `src/app/[locale]/loading.tsx`
- `src/app/[locale]/mien-phi-hom-nay/loading.tsx` *(new)*

### Fonts
- `src/app/layout.tsx`
- `src/app/globals.css`

### Tests
- `src/test/m25-performance-wiring.test.ts` *(new)*
- `src/test/m22-ui-wiring.test.ts`

### Docs
- `docs/M25_V134_FINAL_REPORT.md` *(this file)*

---

## 16. QUALITY GATES

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** (0 errors) |
| `npm run test` | **PASS** — 78 files / **644** tests |
| `npm run build` | **PASS** |
| Migration validation | **N/A** — no schema change in M25 |

---

## 17. REMAINING FINDINGS

### P0
- *(none open for measured branding/homepage query duplication)*

### P1
- Live CWV / TTFB on Neon+Vercel still unmeasured
- Homepage still `force-dynamic` (flag kill-switch) — largest remaining render-mode cost
- Catalog thinness (product) dominates perceived value

### P2
- Search hybrid latency under load
- Homepage section count / competing CTAs
- Below-fold home sections still block first paint (no Suspense split yet — avoided over-fragmentation)

### P3
- Admin list/count query tuning
- Further Client Component lazy-load for rare Admin charts

---

## 18. ACCEPTED RISKS

- Home free-cert/short teaser may miss courses outside newest-60 published pool
- Branding cache up to ~60s stale after Admin change (tag revalidate mitigates on write path)
- No live RUM/Lighthouse numbers in this report

---

## 19. MANUAL PRODUCTION VALIDATION

1. Deploy preview → Lighthouse mobile on `/vi`, `/vi/search`, `/vi/mien-phi-hom-nay`, one course
2. Click nav: confirm top loader + skeleton, no blank
3. Admin branding upload → logo updates within seconds (tag + path revalidate)
4. Confirm Truth / coupon / outbound unchanged
5. Confirm feature flags still kill compare/path/tracker without rebuild when dynamic

---

## 20. FINAL RECOMMENDATION

**Nếu chỉ làm 3 việc tiếp theo:**

1. **Làm dày catalog** các domain cốt lõi (đây là nút cổ chai sản phẩm #1).  
2. **Đơn giản hóa homepage + nav** về funnel Visitor → Search/Daily free → Detail → Outbound.  
3. **Đo CWV thật trên staging** rồi mới quyết định ISR/Suspense split tiếp (không đoán).

**FreeLearn Radar KHÔNG nên xây tiếp:** semantic/AI search mở rộng, Learning Paths nội dung lớn, Compare v2, Tracker/alerts scale, affiliate expansion, Redis/microservice, redesign UI lớn.

---

## CACHE ROUTE MATRIX (audit snapshot)

| Route | Mode | Notes |
|---|---|---|
| `/[locale]` | force-dynamic | FEATURE_* reads |
| `/[locale]/search` | dynamic via searchParams | SoftGetForm |
| `/[locale]/mien-phi-hom-nay` | force-dynamic | loading added |
| `/[locale]/free-courses/[topic]` | revalidate 3600 | branding tag bust |
| `/[locale]/category/[slug]` | searchParams | catalog |
| `/admin/*` | force-dynamic | auth |

**External calls on public render:** AI/embed/source-fetch/coupon-verify **should not** block normal page HTML — no new blockers introduced; hybrid search remains request-path when enabled + query present.

---

**STOP.** Không commit / push / deploy theo yêu cầu M25.
