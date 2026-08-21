# FreeLearn Radar

Course discovery engine: Tavily → candidates → NVIDIA analysis → **human approve** → public free catalog. Stack: Next.js 15 App Router, Drizzle, Neon Postgres, Vitest. Default locale `vi`.

## Codebase Audit

Chi tiết: `docs/audit/05-summary.md` (2026-08-21, commit `25fa234`). Sức khỏe tổng thể **C+**: code nền tốt, sản phẩm chưa chứng minh trên catalog/live. Các remediation đã làm sau audit: `docs/audit/05-summary.md` §4b.

### Architecture rules

- `src/domain` must not import `src/app`.
- Call Tavily/NVIDIA/Resend/R2 through adapters (`src/services/*` or storage factory), not from UI.
- Admin APIs: middleware JWT + `assertAdmin` / `assertEditor` in the handler.
- Cron: fail-closed without `CRON_SECRET`; never skip Truth filters on free lists. `/api/health?deep=1` needs the same credential.
- Every metered outbound call records one `api_usage_log` row via `recordApiUsage` / `measureApiUsage` (`src/domain/admin/api-usage.ts`); the write is best-effort and must never fail the call it measures.
- Feature flags are runtime kill switches: only the string `"true"` enables them; flag-gated pages must not be statically prerendered (`src/test/feature-flag-runtime.test.ts`).
- Affiliate signals must not feed search ranking.
- Do not auto-publish courses.

### Hotspots — edit carefully

- `src/db/repositories/course-repository.ts` (catalog Truth)
- `src/domain/candidate/approve-candidate.ts`
- `src/lib/env.ts` and `FEATURE_*` call sites
- `src/app/[locale]/page.tsx`, `course/[slug]/page.tsx`
- Admin i18n dictionaries

### Implicit product rules

- `RELEVANCE_FLOOR` empty ⇒ semantic path stays off even if search flags are on.
- `EMAIL_DRY_RUN` defaults true. `MONITOR_OBSERVED_REGION` defaults `US`.
- Stale candidates expire after 30 days. Session cookie lasts 7 days, but every authenticated request re-reads the user row, so a deleted user, a role change, or a bumped `users.session_version` takes effect immediately (falls back to the token only when the database is unreachable).
- Keep `FEATURE_AUTO_STATUS` / `FEATURE_PRICE_ALERTS` off until event replay is clean.

Do not add product surface (compare, paths, RSS, new flags) until coverage on `/admin/coverage` is healthy.
