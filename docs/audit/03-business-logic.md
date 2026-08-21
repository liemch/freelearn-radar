# 03 · Business Logic

> **Dự án:** freelearn-radar · **Ngày audit:** 2026-08-21 · **Commit:** `25fa234`
> **Pha:** 4/6

## 1. Bản đồ domain nghiệp vụ

| Domain | Service / module |
|---|---|
| Discovery | `discovery-engine.ts`, `discovery-query-service.ts` |
| Candidate lifecycle | `candidate-service.ts`, `analyze-candidate.ts`, `approve-candidate.ts`, `auto-reject.ts`, `expire-stale.ts` |
| Truth (giá / chứng chỉ / free lists) | `free-status.ts`, `provider-policy.ts`, `free-durability.ts`, `verify-batch.ts` |
| Ranking / public catalog | `ranking/index.ts`, `course-repository.ts` |
| Monitor / events | `observe-course.ts`, `detect-events.ts` |
| Alerts | `watch-service.ts`, `notify-watches.ts` |
| Search | `lexical.ts`, `hybrid.ts`, `semantic.ts`, `nl-intent.ts` |
| Coupon | `coupon-discovery-runner.ts`, `coupon-verification-runner.ts` |
| Coverage ops | `growth-priority.ts`, `discovery-recommendations.ts` |
| Affiliate | `resolve-placements.ts` |
| Media / storage | `media-resolver.ts`, `managed-asset-service.ts` |

## 2. Chi tiết từng nghiệp vụ chính

### Discovery → candidate

- **Entry:** `GET/POST /api/cron/discover`, `POST /api/admin/discovery/run`.
- **Luồng (FACT):**
  1. Cron auth (`cron/discover/route.ts:24-26`).
  2. Nếu không `TAVILY_API_KEY` → 503 (`:29-37`).
  3. `expireStaleCandidates(db, 30)` (`:43`).
  4. `runDiscoveryBatch` lấy query due, gọi SearchProvider, `ingestSearchResult` (`discovery-engine.ts`).
  5. `fetchPendingCandidates` HTML an toàn.
  6. Nếu có NVIDIA key: `analyzePendingCandidates` (không publish).
  7. Audit `DISCOVERY_RUN`.
- **Quy tắc:** `DISCOVERY_QUERY_LIMIT` default 50, `DISCOVERY_RESULT_LIMIT` 10, `AI_ANALYSIS_LIMIT` 60, `MAX_SOURCE_FETCHES_PER_RUN` 60 (env).
- **Side effects:** rows candidates, rejections, query success/fail counts, audit.
- **Lỗi:** per-query isolation (engine); Tavily thiếu → không chạy.
- **Ý đồ (suy đoán, chắc cao):** tăng coverage catalog mà không auto-publish.

### Approve / publish

- **Entry:** `POST /api/admin/candidates/[id]` action approve.
- **Luồng (FACT):** `approve-candidate.ts` — gate `canApproveCandidate`; parse `courseAnalysisSchema`; `assertSafeHttpUrl`; load `provider_policies`; `resolveCertificateWithPolicy`; `assertCertificateResolved` / `assertPriceTypeAllowed`; `assertVisibleOnPublicCatalog`; create course + categories + verification evidence; candidate → APPROVED; audit.
- **Quy tắc:** AI không tự publish (không có code path auto-approve — audit v1.2 0.11). `FREE_WITH_COUPON` / `FREE_AUDIT` bị policy siết.
- **Side effects:** `courses` row, verifications, possibly published.
- **Ý đồ (suy đoán):** human-in-the-loop là invariant sản phẩm.

### Truth / free lists

- **Entry:** mọi list public qua repository catalog.
- **FACT:** `FREE_LIST_EXCLUDED_PRICE_TYPES` trong `free-durability.ts` áp dụng kèm filter (sau R1.1, `V1_2_REMEDIATION_IMPLEMENTATION.md`). `?price=` không nhận `FREE_TRIAL`/`PAID`.
- **Verify cron:** cập nhật price/cert từ evidence; audit `COURSE_VERIFICATION_UPDATE`.
- **Ý đồ (suy đoán):** “free” = 100% off / audit rõ ràng, không trial.

### Monitor + events + auto-status

- **Entry:** `/api/cron/monitor` nếu `MONITOR_ENABLED` không `"false"`.
- **FACT:** fetch course page (SSRF-safe), append `course_observations`, `confirmTransitionsFromObservations` (spacing ≥2h, region, evidence — R2.1). `FEATURE_AUTO_STATUS` mới rewrite `courses.priceType`. Events `isPublic` kiểm soát tracker.
- **Side effects:** observations, price events, optional course fields, optional emails.
- **Xử lý lỗi:** budget `MONITOR_DAILY_FETCH_BUDGET`, per-domain RPM, kill switch.
- **Ý đồ (suy đoán):** tránh alert sai; flags OFF cho đến replay sạch.

### Search

- **Entry:** `/[locale]/search`.
- **FACT:** mặc định lexical SQL (`lexical-sql.ts` unaccent + trigram). Semantic/hybrid chỉ khi flag `"true"` **và** `RELEVANCE_FLOOR` set (`env.ts:102-108`). Timeout vector → degrade lexical (`hybrid.ts` / semantic). Search queries logged (`recordSearchQuery`).
- **Eval:** `data/search-eval/v1/queries.json` labels empty → NDCG null (`benchmark.ts`, STOP_1).
- **Ý đồ (suy đoán):** không bịa chất lượng search trên catalog mỏng.

### Coupon 100% off

- **FACT:** sources seed; Real.Discount **disabled placeholder** (`src/db/seed/coupon-sources.ts:24-33`). Runner no-op nếu `FEATURE_COUPON_DISCOVERY !== "true"`. Aggregator không tự publish ACTIVE_100_OFF (M21.12 tests).
- **Ý đồ (suy đoán):** coupon là nguồn phụ, không thay Truth.

### Coverage / growth (M26–M27)

- **FACT:** classify EMPTY/THIN/HEALTHY/STRONG (`coverage-thresholds.ts`). Recommend queries **enabled only**. Plan dry-run `mutatesDatabase: false` rồi operator confirm (`discovery/plan` API + admin coverage).
- **Ý đồ (suy đoán):** vận hành catalog, không auto-fill bằng AI hallucinate.

## 3. Quy tắc nghiệp vụ ngầm

| Quy tắc | Vị trí | Rủi ro nếu không biết |
|---|---|---|
| Flag chỉ bật khi string đúng `"true"` | khắp `FEATURE_* === "true"` | `"1"` / `"TRUE"` = tắt |
| `RELEVANCE_FLOOR` trống = semantic không chạy dù flag ON | `env.ts:102-108` | bật hybrid sớm → vẫn lexical |
| `EMAIL_DRY_RUN` default true | `env.ts:205` | nghĩ đã gửi mail |
| `MONITOR_OBSERVED_REGION` default `"US"` | `env.ts:66` | so sánh giá sai thị trường |
| Stale candidate 30 ngày → `EXPIRED_UNREVIEWED` | discover cron + `expire-stale.ts` | inbox “mất” candidate |
| Session 7 ngày, không revoke khi đổi password | `constants.ts`, SECURITY.md | session cũ còn sống |
| Locale default `vi`, switcher OFF | `i18n/config.ts` | `/en/...` vẫn reach bằng URL |
| Seed sample courses cấm production | `.env.example:34-36` | catalog giả trên prod |
| Affiliate không vào ranking | comments M20.12 | “tối ưu doanh thu” phá Truth |
| `sameRegion` historically vacuous — đã stamp region sau R2 | detect-events + env | đừng tắt region |
| ETag observation luôn `null` | `observe-course.ts:262` | tốn bandwidth fetch |
| Cron discover 2 lần/ngày | `vercel.json:3-11` | chi phí Tavily/AI gấp đôi so docs cũ 1× |

Magic numbers: coverage THIN ≤4, HEALTHY ≤14 (`docs/M26`); monitor spacing 2h (spec §69.3); login 10 req/60s (`login/route.ts:26`).

## 4. Tích hợp bên ngoài

| Service | Mục đích | Nơi gọi | Lỗi/retry |
|---|---|---|---|
| Tavily | Web search | `tavily-search-provider.ts` | cron 503 nếu thiếu key; batch isolation |
| NVIDIA NIM | Classify/summarize/score + embeddings | `nvidia-nim-provider.ts`, embedding provider | timeout `AI_REQUEST_TIMEOUT_MS`; Zod parse fail → AI_PARSE_ERROR |
| Provider websites | Metadata / monitor / coupon | `safe-http-client.ts` | timeout, max bytes, redirects, SSRF deny |
| Resend | Alert email | `email-provider.ts` | AbortController; dry-run default |
| Cloudflare R2 | Binaries | `r2-provider.ts` | flags OFF → fake/no-op path |
| TechHub Supabase | Admin push | `services/techhub` | optional keys |
| Neon | DB | `src/db/index.ts` | pool max 10; pooler `prepare:false` |

## 5. Vùng mờ cần xác nhận

1. Production `FEATURE_AUTO_STATUS` / `FEATURE_PRICE_ALERTS` đang true hay false? (R0.1, không đọc được từ repo.)
2. Catalog live: bao nhiêu PUBLISHED eligible? Gate B ghi ~1 khóa (2026-08-14) — còn đúng?
3. `RELEVANCE_FLOOR` đã derive từ labelled set chưa? (vẫn blank trong `.env.example`.)
4. M18.5 (deferred trong `project-plan.md:2154`) còn là backlog có chủ đích?
5. R4: keyboard shortcuts, bulk undo, RSS, Group-A parser onboarding — còn cần?
6. TechHub có thuộc sản phẩm Radar hay side project?
7. Eval dataset 62 stubs: ai sẽ gán nhãn Gate B thật?
8. Coupon source Real.Discount: enable khi nào / policy?
9. `api_usage_log` có kế hoạch cover Tavily/NVIDIA không?
10. Bytea branding vs R2: migration cutover đã chạy production?
11. NVIDIA model default `nemotron-3-super` vs ADR embed `nv-embedqa-e5-v5` — Llama NIM deprecate note trong PRODUCTION_READINESS.md còn valid?
12. Cron discover 2×/ngày: cố ý sau M27 hay leftover?
