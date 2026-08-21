# 04 · Bảo mật & Rủi ro

> **Dự án:** freelearn-radar · **Ngày audit:** 2026-08-21 · **Commit:** `25fa234`
> **Pha:** 5/6

## 1. Tổng hợp

| Mức độ | Số lượng |
|---|---|
| Critical | 0 |
| High | 2 |
| Medium | 6 |
| Low | 5 |

Nhận định: **không thấy secret hardcode hay SQL injection nối chuỗi user input**. Mô hình threat (Tavily/HTML/AI untrusted, admin trusted) được kiểm soát bằng Zod, URL allowlist, human approve. Rủi ro chính: **rate-limit mềm trên serverless**, **JWT không revoke**, **bật flag tracker/alerts quá sớm**, **cron/AI cost**, và **vận hành catalog/live chưa chứng minh**.

`npm audit` **không chạy được** trong môi trường audit (Node CLI không có trên PATH). Cần chạy sau trên máy có Node.

## 2. Phương pháp & phạm vi

- Đọc env/auth/middleware/cron/url/SSRF/login; grep `sql` tagged templates (Drizzle parameterized).
- Đối chiếu `docs/SECURITY.md`, remediation v1.2, M21.12.
- Không pentest, không đọc `.env` local, không access Vercel/Neon.

## 3. Findings bảo mật

### [SEC-01] [High] Rate limit login chỉ in-memory per-instance

- **Mô tả:** `checkRateLimit` dùng `Map` process-local (`src/lib/rate-limit.ts:6-11`, comment serverless). Login: 10/60s (`login/route.ts:26`).
- **Tác động:** brute-force song song trên nhiều lambda instance.
- **Khuyến nghị:** rate limit tại edge/WAF/Upstash trước khi publicize `/admin/login`; giữ fail-closed.

### [SEC-02] [High] Session JWT không revoke khi đổi mật khẩu

- **Mô tả:** TTL 7 ngày (`constants.ts:2`); SECURITY.md đã ghi. Không denylist/`jti`.
- **Tác động:** tài khoản bị chiếm hoặc password rotate vẫn giữ session cũ.
- **Khuyến nghị:** version password trong JWT hoặc bảng session; rút `AUTH_SECRET` khi incident (đã có trong SECURITY.md).

### [SEC-03] [Medium] Cron secret trên GET URL nếu operator lỡ log

- **Mô tả:** Vercel cron dùng header (không query). Handler chấp nhận `x-cron-secret` (`cron-auth.ts:14`). Rủi ro vận hành nếu ai curl nhét secret vào query string (không thấy parser query trong verifyCronAuth — **chỉ header**). Giảm thành: log `Authorization` nếu logger dump headers.
- **Tác động:** thấp nếu không log headers; Medium nếu platform access log.
- **Khuyến nghị:** không log headers; chỉ Bearer.

### [SEC-04] [Medium] `GET /api/health?deep=1` lộ trạng thái DB

- **Mô tả:** Public, 503 nếu DB lỗi (`health/route.ts:23-35`). SECURITY.md xếp Low.
- **Tác động:** recon; không dump data.
- **Khuyến nghị:** bảo vệ deep bằng secret hoặc chỉ internal.

### [SEC-05] [Medium] Affiliate outbound tin admin URL

- **Mô tả:** SECURITY.md: URL không domain-bind provider. `go/affiliate` validate locale/open-redirect (`go/affiliate/route.ts:29-40`).
- **Tác động:** admin bị phishing seed → user redirect độc hại.
- **Khuyến nghị:** allowlist domain theo campaign; giữ RBAC chặt.

### [SEC-06] [Medium] Flag + worker đổi giá nếu bật sớm

- **Mô tả:** `FEATURE_AUTO_STATUS` / `FEATURE_PRICE_ALERTS` default OFF nhưng machinery đầy đủ. Confirmation rules đã vá (R2), **live flag** không verify được.
- **Tác động:** sai giá public / email rác nếu ON trước replay.
- **Khuyến nghị:** xác nhận Vercel env; SOP bật từng tầng (`V1_2_REMEDIATION_IMPLEMENTATION.md:221-229`).

### [SEC-07] [Medium] Inbound watches công khai khi flag ON

- **Mô tả:** `POST /api/watches` public. Token hashing đã harden (R2.6 tests). Email dry-run mặc định.
- **Tác động:** spam watches / tốn Resend khi dry-run tắt.
- **Khuyến nghị:** captcha/rate-limit phân tán; giữ `EMAIL_DRY_RUN` đến khi deliverability xong.

### [SEC-08] [Low] EDITOR vs ADMIN share publish

- **Mô tả:** Cố ý MVP (`rbac.ts`, SECURITY.md).
- **Khuyến nghị:** tách publish nếu tăng số editor.

### [SEC-09] [Low] CI build thiếu `CRON_SECRET`

- **Mô tả:** `ci.yml` set `AUTH_SECRET` + `DATABASE_URL` dummy, không `CRON_SECRET`. `getServerEnv` chỉ enforce secret khi production **runtime** (`env.ts:246`). Next `build` set `NODE_ENV=production` → **có thể** fail hoặc skip tùy chỗ gọi env lúc build. (suy đoán) CI đang PASS vì pages dùng `process.env` fallback — cần xác nhận.
- **Khuyến nghị:** set dummy `CRON_SECRET` ≥16 trong CI cho khớp prod.

### [SEC-10] [Low] Không CSP / HSTS trong `next.config.ts`

- **Mô tả:** Có nosniff, frame deny, referrer, permissions-policy (`next.config.ts:10-16`). Không `Content-Security-Policy` / `Strict-Transport-Security` (Vercel có thể thêm HSTS ở platform).
- **Khuyến nghị:** CSP report-only rồi enforce.

### [SEC-11] [Low] TechHub Supabase anon key trong env server

- **Mô tả:** `TECHHUB_SUPABASE_ANON_KEY` (`.env.example:31`). Anon key thiết kế public nhưng admin push cần review RLS bên Supabase (ngoài repo).
- **Khuyến nghị:** xác nhận RLS; đừng dùng service role trong Next.

### [SEC-12] [Low] Bootstrap password

- **Mô tả:** `ADMIN_BOOTSTRAP_PASSWORD=change-me-in-production` example. Seed production vẫn tạo admin nếu misconfig.
- **Khuyến nghị:** checklist đổi password ngay sau seed; không seed user trên prod nếu đã có.

**Không thấy:** private key trong repo; `.env` không tracked. Injection: `sql` fragments dùng column refs Drizzle, lexical `like` với pattern bound.

## 3b. Đã khắc phục trong repo (2026-08-21)

| Finding | Trạng thái | Thay đổi |
|---|---|---|
| SEC-02 session revoke | **Fixed** | `users.session_version` (migration `0017`) + claim `sv` trong JWT; `getSession()` đọc lại user row nên xóa user / hạ quyền / revoke có hiệu lực ngay. DB chết thì fallback về token (chọn availability). UI: Admin → Users → *Revoke sessions* |
| SEC-04 deep health public | **Fixed** | `?deep=1` yêu cầu `CRON_SECRET` khi biến này được cấu hình; liveness vẫn public |
| SEC-07 watches spam | **Đính chính** | Rate limit theo IP (10/h) và theo email (5/h) **đã có sẵn** trong `api/watches/route.ts:42-76`; audit trước đó đánh giá thiếu. Còn lại đúng phần in-memory (SEC-01) |
| SEC-09 CI thiếu `CRON_SECRET` | **Fixed** | `ci.yml` set dummy ≥16 ký tự cho cả test và build |
| SEC-10 CSP/HSTS | **Fixed (một phần)** | `next.config.ts` enforce CSP + HSTS. `script-src`/`style-src` vẫn cần `'unsafe-inline'` vì JSON-LD và locale script render inline; nonce sẽ ép mọi trang catalog thành dynamic |
| RISK-04 usage log thiếu | **Fixed** | `api_usage_log` giờ nhận `search` (Tavily), `ai_analysis` (NVIDIA), `email` (Resend/dry-run), `source_fetch`; xem tại `/admin/analytics` |
| RISK-05 docs drift | **Fixed** | Thêm `README.md`; viết lại `PRODUCTION_READINESS.md` (6 cron, 18 migration, health có auth); `project-plan.md` trỏ về `docs/audit/` |
| RISK-10 CVE chưa scan | **Fixed (một phần)** | `drizzle-orm` lên `0.45.2` (SQL injection qua identifier, High). Còn `sharp`/`postcss` là transitive của Next 15, chỉ sạch khi lên Next 16 — CI báo cáo nhưng chỉ chặn ở mức critical |

Chưa xử lý (cố ý): SEC-01 (cần Upstash/WAF — thêm hạ tầng), SEC-05, SEC-06, SEC-11, SEC-12.

## 4. Rủi ro vận hành & bảo trì

### [RISK-01] [High] Catalog mỏng + search gates N/A

STOP_1 / Gate B: ~1 published course; NDCG không đo được. Bật hybrid/semantic không có bằng chứng chất lượng.

### [RISK-02] [High] Feature surface > operating loop

M25: homepage/nav nặng. Flags OFF che nợ — bật đồng loạt làm UX và chi phí AI/R2/cron nổ.

### [RISK-03] [Medium] Cron 300s + 2× discovery/ngày

`maxDuration = 300` (`cron/discover/route.ts:16`). Timeout Vercel Hobby vs Pro khác nhau (không xác minh plan). Discover 2 schedules (`vercel.json:3-11`) nhân chi phí Tavily/NIM.

### [RISK-04] [Medium] `api_usage_log` không cover Tavily/NVIDIA/Resend

Không có budget view thật (`V1_2_REMEDIATION_IMPLEMENTATION.md:199-201`).

### [RISK-05] [Medium] Docs drift

Không README; `PRODUCTION_READINESS.md` cron/migration cũ; `project-plan.md` progress 2026-08-14.

### [RISK-06] [Medium] God files / bus factor

`course-repository.ts` 866 LOC, 12 lần đổi/12 tháng; coverage admin page 578; i18n admin 20+ commits. 80 test files / 397 source — khá, nhưng god files ít unit test theo từng query path.

### [RISK-07] [Medium] Object storage chưa cutover

M24 flags OFF; binaries vẫn có thể nằm bytea (schema site assets). Neon size (suy đoán) tăng nếu branding lớn.

### [RISK-08] [Low] Verify harness ngoài CI

`scripts/verify/*` không chạy trên GitHub Actions.

### [RISK-09] [Low] Eval labels trống

`queries.json` stubs; benchmark NDCG null.

### [RISK-10] [Low] Dependency CVE chưa scan

Node không có trên PATH audit session.

## 5. Hotspot (git history)

| File | Đổi 12 tháng | LOC ~ | Có test? | Nhận định |
|---|---|---|---|---|
| `src/lib/i18n/admin/vi.ts` | 21 | 686 | gián tiếp completeness test | churn copy |
| `src/lib/env.ts` | 14 | 266 | `env.test.ts` | flags — cẩn thận regression |
| `src/db/repositories/course-repository.ts` | 12 | 866 | `catalog-sql.test.ts` | catalog truth |
| `src/app/[locale]/page.tsx` | 11 | 430 | ít | homepage IA |
| `src/app/[locale]/course/[slug]/page.tsx` | 11 | 546 | flags test | chi tiết khóa |
| `scripts/neon-bootstrap.sql` | 12 | generated | generate script | đừng sửa tay |
| `src/domain/candidate/approve-candidate.ts` | 9 | 443 | `approve-candidate.test.ts` | publish gate |

## 6. Performance smell (phân tích tĩnh)

| Smell | Vị trí | Tác động tiềm năng | Gợi ý |
|---|---|---|---|
| Homepage nhiều query song song | comment `src/db/index.ts:13-19` | TTFB nếu pool=1 | giữ `DATABASE_POOL_MAX` + Neon pooler |
| Branding resolve trùng (M25 đã sửa một phần) | branding module | LCP | đo lại Lighthouse live |
| Lexical `like` + trigram | `lexical-sql.ts` | CPU khi catalog lớn | index đã có migration 0001/0008; đo EXPLAIN |
| Vector timeout 250ms | `VECTOR_QUERY_TIMEOUT_MS` | degrade lexical | OK |
| Monitor etag null | `observe-course.ts:262` | bandwidth | If-None-Match |
| Rate limit Map | serverless | không perf | — |
| Admin coverage page 578 dòng | RSC nặng | admin TTFB | tách query |

Cần đo thật: Lighthouse, Neon insights, cron duration.

## 7. Việc chưa kiểm được

- Giá trị env production / flag
- RLS TechHub Supabase
- CVE npm
- Email deliverability / bounce webhook (chưa có)
- Parser BLOCKED rate từng provider
- CWV production
- Migration `0016` đã apply trên Neon chưa
