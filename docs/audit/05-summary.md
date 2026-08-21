# 05 · Tổng kết & Lộ trình

> **Dự án:** freelearn-radar · **Ngày audit:** 2026-08-21 · **Commit:** `25fa234`
> **Pha:** 6/6

## 1. Tóm tắt 1 trang

FreeLearn Radar là **course discovery engine** (Next.js 15 + Drizzle + Neon): search → candidate → AI → admin duyệt → catalog miễn phí đã kiểm chứng. Code **đã đi xa hơn MVP** (M15–M27: monitor, semantic, coupon, R2, coverage ops, TechHub).

Tình trạng: **nền tảng kỹ thuật vững, sản phẩm vận hành chưa toàn vẹn**. Hầu hết tính năng “v1.3+” nằm sau `FEATURE_*=false`, email dry-run, `RELEVANCE_FLOOR` trống, eval search chưa gán nhãn. Catalog historically quá mỏng để chứng minh search/CWV. Live Neon/R2/Lighthouse **chưa đo trong repo reports**.

Để **ổn định nhất**: đừng thêm milestone sản phẩm; **đóng vòng vận hành** (secrets, cron, coverage, Truth) rồi mới bật từng flag.

## 2. Điểm sức khỏe tổng thể: **C+**

| Hạng mục | Điểm | Lý do |
|---|---|---|
| Kiến trúc | B+ | Modular monolith rõ; god files; R2/SDK trong domain |
| Chất lượng code | B | Tests dày, CI, Zod, SSRF; file 800+ dòng |
| Bảo mật | B− | Không P0 code; rate-limit mềm, JWT revoke, flags nguy hiểm nếu ON |
| Tài liệu | C+ | Nhiều report xuất sắc nhưng stale, **không README** |
| Khả năng bảo trì | C+ | Surface lớn, i18n/env hotspot, bus factor |
| Sẵn sàng production | C | Code READY; catalog/flags/live proof chưa |

Thang: A = vận hành có số liệu; F = không chạy được. C+ = ship được core nếu operator kỷ luật flags.

## 3. 5 điều quan trọng nhất người mới cần biết

1. **Không auto-publish.** Mọi khóa public đi qua approve + Truth filters (`approve-candidate.ts`, `free-durability.ts`).
2. **`FEATURE_* === "true"` mới bật** — giá trị khác = tắt. Semantic còn cần `RELEVANCE_FLOOR`.
3. **Cron + `CRON_SECRET` fail-closed**; discover chạy **hai lần/ngày**.
4. **v1.2 P0 leaks FREE_TRIAL đã vá trong code** (R1); đừng revert catalog SQL.
5. **Nợ thật là vận hành + catalog**, không phải thiếu UI: coverage admin (`/admin/coverage`) là chỗ làm việc tiếp theo.

## 4. Action items

Ưu tiên ổn định / toàn vẹn (không “thêm feature”).

| # | Việc | Mức độ | Effort | Tham chiếu |
|---|---|---|---|---|
| 1 | Xác nhận prod flags `FEATURE_AUTO_STATUS` / `PRICE_ALERTS` OFF | High | S | 04 SEC-06, R0.1 |
| 2 | Checklist live: Neon migrate 0000–0017, Tavily, NVIDIA, `AUTH_SECRET`/`CRON_SECRET`, smoke `/api/health?deep=1` (nay cần bearer cron secret) | High | S | 00, LIVE_INTEGRATION |
| 3 | Chạy vòng discovery → review → publish đến catalog **HEALTHY** vài topic cốt | High | L | 03 coverage, RISK-01 |
| 4 | README + sửa `PRODUCTION_READINESS` / progress `project-plan.md` cho khớp cron/flags | Medium | S | 00, RISK-05 |
| 5 | `npm audit` + ghim CI `CRON_SECRET` dummy | Medium | S | 04 SEC-09, RISK-10 |
| 6 | Rate-limit phân tán cho login (và watches nếu bật) | High | M | SEC-01 |
| 7 | Log `api_usage_log` cho Tavily/NVIDIA/Resend + dashboard budget | Medium | M | R3 leftover |
| 8 | Giữ flags OFF; chỉ bật `FEATURE_DISCOVERY_UX` / media nếu UX cần; **không** hybrid cho đến STOP_1 | High | S | STOP_1, M20.11 |
| 9 | Gán nhãn eval + đặt `RELEVANCE_FLOOR` khi catalog đủ | Medium | M | 03 search |
| 10 | ETag/If-None-Match monitor | Low | M | observe-course.ts:262 |
| 11 | Cutover R2 có số đo bytea; orphan cleanup | Medium | M | M24 flags |
| 12 | Session revoke / password version | Medium | M | SEC-02 |
| 13 | Tách `course-repository.ts` / coverage page | Low | L | hotspot |
| 14 | Quyết định TechHub: in-product hay tách repo | Low | S | vùng mờ |
| 15 | **Không làm** M18.5 / RSS / keyboard shortcuts / compare-path cho đến khi catalog nóng | — | — | R4, M25 |
| 16 | Replay events trước mọi ý định bật tracker | High | S | remediation order |
| 17 | Lighthouse staging sau deploy | Medium | S | M27 |
| 18 | CSP report-only | Low | S | SEC-10 |

## 4b. Đã implement (2026-08-21, sau audit)

Các item chỉ cần code đã làm xong; phần còn lại cần credentials live hoặc quyết định hạ tầng.

| # | Việc | Trạng thái |
|---|---|---|
| 4 | README + `PRODUCTION_READINESS` + progress `project-plan.md` | **Done** |
| 5 | CI `CRON_SECRET` dummy + bước `npm audit`; vá CVE High `drizzle-orm` | **Done** |
| 7 | `api_usage_log` cho Tavily/NVIDIA/Resend/source fetch + panel budget ở `/admin/analytics` | **Done** |
| 12 | Session revoke (`users.session_version`, claim `sv`, nút *Revoke sessions*) | **Done** |
| 18 | CSP + HSTS (enforce, không phải report-only) | **Done** |
| 6 | Rate-limit phân tán | **Chưa** — cần Upstash/WAF, là quyết định hạ tầng chứ không phải code |
| 10 | ETag/If-None-Match monitor | **Chưa (cố ý)** — 304 sẽ tạo observation không có price, ảnh hưởng logic confirm event; budget monitor 50 fetch/ngày nên lợi ích băng thông không đáng đổi rủi ro |
| 1, 2, 3, 9, 11, 16, 17 | Flags prod, checklist live, catalog, eval labels, R2 cutover, replay, Lighthouse | **Chưa** — cần môi trường live |

Migration mới: `drizzle/0017_session_revocation.sql` (thêm `users.session_version`). Deploy chạy `db:migrate:run` tự động; nếu bootstrap tay thì `scripts/neon-bootstrap.sql` đã regenerate.

## 5. Checklist tiếp nhận (takeover readiness)

### P0 — Blocker bàn giao

- [ ] Neon `DATABASE_URL` (nên `-pooler`) + confirm tables M19–M24
- [ ] Vercel env: `AUTH_SECRET` ≥32, `CRON_SECRET` ≥16, `APP_URL`
- [ ] `TAVILY_API_KEY`, `NVIDIA_API_KEY` (discovery/AI)
- [ ] Admin user thật (không bootstrap mặc định)
- [ ] Xác nhận flags nguy hiểm OFF trên Production
- [ ] Quyền GitHub/Vercel/Neon/R2/Resend/TechHub
- [ ] Backup Neon / point-in-time
- [ ] Tài liệu deploy: `README.md` → `docs/PRODUCTION_READINESS.md` (đã cập nhật 2026-08-21) + bản audit này

### P1 — Tuần đầu sau nhận

- [ ] `npm ci && npm run lint && typecheck && test && build` local
- [ ] `npm audit`
- [ ] Một vòng cron discover thủ công + 1 candidate approve
- [ ] `EMAIL_DRY_RUN` vẫn true
- [ ] Đo `/admin/coverage` T0
- [ ] Rotate secret nếu từng commit/.env share

### Câu hỏi cho bên bàn giao

- [ ] Flag production hiện tại là gì?
- [ ] Catalog size / EMPTY topics thật?
- [ ] NVIDIA model production vs deprecate Llama (PRODUCTION_READINESS)?
- [ ] Discover 2×/ngày có cố ý? Chi phí Tavily tháng?
- [ ] TechHub có SLA?
- [ ] R2 đã provision chưa?
- [ ] Ai gán nhãn search eval?
- [ ] Sự cố hay gặp (SSRF block, AI parse, pooler prepare)?
- [ ] Có khách phụ thuộc hành vi bug-as-feature?

## 6. Lộ trình onboarding gợi ý

**Ngày 1:** `docs/audit/05-summary.md` → `SECURITY.md` → `.env.example` → `src/lib/env.ts` → `middleware.ts` → `approve-candidate.ts` + `free-durability.ts`. Chạy test.

**Ngày 2:** `discovery-engine.ts` + cron discover/verify. Admin: candidates, coverage.

**Tuần 1:** không đụng semantic/affiliate. Làm đầy catalog + đo. Chỉ đọc M20.11 khi muốn bật search.

**Chạy local (từ PRODUCTION_READINESS, còn đúng):**

```bash
npm install
# DATABASE_URL + AUTH_SECRET trong .env
npm run db:migrate:run && npm run db:seed
npm run dev
```

## 7. Mục lục báo cáo

- [00 Overview](./00-overview.md)
- [01 Architecture](./01-architecture.md)
- [02 API & flows](./02-api-flows.md)
- [03 Business logic](./03-business-logic.md)
- [04 Security & risks](./04-security-risks.md)

## 8. CLAUDE.md

Đã tạo `CLAUDE.md` ở root (file chưa tồn tại). Phần audit <80 dòng; chi tiết ở đây.

## 9. Đề xuất sử dụng bộ report

- [ ] PR riêng `docs/audit/` + `CLAUDE.md`
- [ ] Thêm README link tới `docs/audit/05-summary.md`
- [ ] dependency-cruiser cho rule A1 (domain ↛ app) khi có bandwidth
- [ ] Action items 1–8 → ticket tracker
- [ ] Wiki onboarding trỏ summary

## Tồn đọng — bản đồ ngắn

**Chưa hoàn thiện (cố ý / dormant):** semantic/hybrid/NL/similar/compare/paths/cross-lang; tracker/alerts/auto-status; coupon public + Real.Discount; R2 uploads; RSS/public events; M18.5; R4 undo/shortcuts; eval labels; ETag monitor; usage log đầy đủ.

**Chưa hoàn thiện (cần làm để ổn định):** live ops proof, catalog coverage, rate-limit phân tán, đo CWV, quyết định bề mặt (TechHub). *(docs/README, session revoke, CI secrets/audit, usage log: đã xong 2026-08-21 — xem §4b.)*
