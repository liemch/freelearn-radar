# 00 · Tổng quan Dự án

> **Dự án:** freelearn-radar · **Ngày audit:** 2026-08-21 · **Commit:** `25fa234`
> **Phạm vi quét:** toàn bộ repo (trừ `node_modules`, `.next`, `docs/ui-reference`) · **Pha:** 1/6

## 1. Dự án làm gì

FreeLearn Radar là website **tìm, chuẩn hóa, kiểm chứng và tuyển chọn khóa học miễn phí** từ nhiều provider (Udemy, Coursera, edX, Microsoft Learn, …), công bố catalog công khai và có admin review trước khi publish.

Pipeline mục tiêu (từ `project-plan.md`): Search (Tavily) → candidate → normalize/dedupe → AI (NVIDIA NIM) → admin approve → public site. Không phải LMS.

Tiến độ code: WP0–WP14 + M15–M27 đã có implementation trong repo. Nhiều bề mặt sản phẩm **tồn tại nhưng dormant** vì `FEATURE_*` default OFF (`.env.example`, `src/lib/env.ts`). Catalog production historically ~1 khóa (Gate B, `docs/GATE_B_INTENT_DIAGNOSIS.md`) — số liệu live **không đo được trong audit này**.

## 2. Tech Stack

| Thành phần | Công nghệ | Version | Ghi chú |
|---|---|---|---|
| Runtime | Node.js | ≥22 (`package.json` engines) | |
| Language | TypeScript | ^5.9 | `strict` (cần xác nhận tsconfig ở pha 1) |
| App | Next.js App Router | ^15.4.6 | Turbopack `dev` |
| UI | React 19 + Tailwind 4 + Radix slot | — | shadcn-style `src/components/ui` |
| ORM | Drizzle | ^0.44 | 17 SQL migrations `0000`–`0016` |
| DB | PostgreSQL (Neon) | — | `postgres` + `@neondatabase/serverless` |
| Vector | pgvector | — | `course_embeddings`, flag semantic OFF |
| Auth | JWT cookie `flr_session` | jose ^6 | Admin/EDITOR, 7 ngày |
| Search | Tavily | — | `src/services/search` |
| AI | NVIDIA NIM | env default nemotron-3-super | `src/services/ai` |
| Embeddings | NVIDIA nv-embedqa-e5-v5 | 1024-dim | cron `/api/cron/embed` |
| Email | Resend / dry-run | `EMAIL_DRY_RUN=true` default | `src/services/email` |
| Object storage | Cloudflare R2 (S3 API) | `@aws-sdk/client-s3` | flags OFF |
| Deploy | Vercel | `vercel.json` | 6 cron entries |
| Test | Vitest | ^3.2.4 | 80 file `*.test.ts` |
| i18n | custom dictionaries | vi default | EN routes giữ cho SEO |

Không có Redis, không có queue riêng, không monorepo.

## 3. Cấu trúc repo

Single package (`package.json` root). Không workspace.

```
src/app/           # Next routes: public [locale], admin, api, go
src/components/    # public, admin, ui, layout, seo, brand
src/domain/        # nghiệp vụ theo bounded context
src/db/            # drizzle schema, repositories, migrate, seed
src/services/      # adapters: AI, search, fetch, email, embedding, techhub, images
src/lib/           # env, auth, url, rate-limit, i18n, logger
src/config/        # thresholds coverage/search
drizzle/           # SQL migrations + meta journal
scripts/           # seed helpers, verify harness, monitor-once, search-baseline
data/search-eval/  # eval stubs (≥60 queries, labels trống)
docs/              # milestone reports (nhiều, một phần stale)
```

## 4. Quy mô

| Metric | Giá trị |
|---|---|
| File `.ts`/`.tsx` (không node_modules) | 500 |
| File nguồn `src` không test | 397 |
| File test `*.test.ts` | 80 (~20% file nguồn) |
| LOC `src` (cat/wc) | ~59 800 |
| Top file | `course-repository.ts` 866 dòng |
| API route files `src/app/api/**/route.ts` | 40 |
| HTTP handlers `export async function GET\|POST\|…` trong `src/app/**/route.ts` | **56** (đối chiếu pha 2) |
| Public pages `[locale]` | 14 |
| Admin pages | 26 |
| SQL migrations | 17 (`0000`–`0016`) |
| Schema barrel exports | 29 modules (`src/db/schema/index.ts`) |
| Commits | 49 |
| TODO/FIXME trong code nguồn | gần như không (1 match `TODO` không phải debt thật) |

## 5. Hạ tầng & môi trường

- **CI:** `.github/workflows/ci.yml` — lint, typecheck, test, build trên Node 22. Không chạy `verify:http` / `verify:db`. Build CI **không set `CRON_SECRET`** (production runtime yêu cầu ≥16 ký tự khi `NODE_ENV=production` hoặc `VERCEL=1` — `src/lib/env.ts:246-256`).
- **Vercel crons** (`vercel.json`): discover 06:00 & 12:00, verify 18:00, monitor 02:00, embed 04:00, coupons 21:00 UTC. Auth: Bearer/`x-cron-secret` (`src/lib/cron-auth.ts`).
- **Build prod:** `vercel-build` = migrate + seed + `next build`. Seed sample courses **tắt** trên production (`SEED_SAMPLE_COURSES`, `.env.example:34-36`).
- **Không** Docker/k8s/terraform trong repo.
- Biến môi trường: `.env.example` đầy đủ; file `.env` local gitignored (`.gitignore:32-33`). Audit **không đọc** `.env`.
- Docs `PRODUCTION_READINESS.md` **stale**: chỉ liệt kê 2 cron, migrations `0000`–`0001`.

## 6. Tài liệu sẵn có

Rất nhiều (`docs/*.md` ~59 file) + 4 project-plan. Chất lượng kỹ thuật cao (audit v1.2, remediation, M19–M27).

Khoảng trống:

- **Không có README.md** ở root.
- `project-plan.md` progress line dừng **2026-08-14**, ghi M18.5 not started — trong khi M20–M27 đã ship trong docs.
- Nhiều report ghi “commit/push/deploy NOT done”. HEAD hiện tại `25fa234` (TechHub i18n crash fix) — (suy đoán) một phần code đã được commit sau các report.
- Không có `docs/audit/` trước phiên này.

## 7. Tín hiệu chất lượng ban đầu

- Có lint (ESLint next), typecheck, vitest, CI trên main/PR.
- Feature-flag runtime test (`src/test/feature-flag-runtime.test.ts`) chặn prerender bake flag.
- Scripts verify PGLite (`scripts/verify/*`) — harness mạnh, **không nằm trong CI**.
- Bus factor: `git shortlog` không in contributor (cấu hình author); 49 commit, file hotspot i18n admin + env + course-repository.
- Tín hiệu rủi ro sản phẩm: catalog mỏng + hầu hết `FEATURE_*` OFF + live Neon/R2/Lighthouse **NOT MEASURED** trong M26/M27 reports.
