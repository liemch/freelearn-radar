# Production Readiness — FreeLearn Radar

Status after M15: **READY_FOR_LIVE_INTEGRATION** (code/config), pending live credentials.

## Environment variables

Documented in `.env.example`:

| Variable | Required locally | Required production | Notes |
|----------|------------------|---------------------|-------|
| `DATABASE_URL` | yes | yes | Neon/Postgres |
| `APP_URL` | yes | yes | Public origin |
| `AUTH_SECRET` | recommended | **yes (≥32)** | Enforced when `NODE_ENV=production` or Vercel |
| `CRON_SECRET` | recommended | **yes (≥16)** | Cron + production gate |
| `ADMIN_EMAILS` | for seed | for seed | Comma-separated |
| `ADMIN_BOOTSTRAP_PASSWORD` | for seed | for seed | Change after first login |
| `TAVILY_API_KEY` | for discovery | for discovery | Soft-fail without it |
| `NVIDIA_API_KEY` | for AI | for AI | Soft-fail without it |
| `NVIDIA_BASE_URL` | optional | optional | Default NIM endpoint |
| `NVIDIA_MODEL` | optional | optional | Default `nvidia/nemotron-3-super-120b-a12b` (Meta Llama NIM endpoints deprecate 2026-08-25) |
| `DISCOVERY_QUERY_LIMIT` | optional | optional | Default 15 |
| `DISCOVERY_RESULT_LIMIT` | optional | optional | Default 5 |
| `AI_ANALYSIS_LIMIT` | optional | optional | Default 30 |
| `MAX_VERIFICATIONS_PER_RUN` | optional | optional | Default 25 (M16 verify cron) |

Never use `NEXT_PUBLIC_` for secrets.

## Commands

```bash
npm install
npm run db:migrate:run
npm run db:seed
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev
```

## Health

- `GET /api/health` → liveness
- `GET /api/health?deep=1` → liveness + `SELECT 1` (503 if DB down)

## Cron

- `vercel.json` schedules:
  - `GET /api/cron/discover` daily `0 6 * * *`
  - `GET /api/cron/verify` daily `0 18 * * *` (M16)
- Header: `Authorization: Bearer $CRON_SECRET`

## Migrations

Append-only:

1. `drizzle/0000_initial_schema.sql`
2. `drizzle/0001_add_query_indexes.sql`

## Security posture (summary)

See `docs/SECURITY.md`.

## Known non-blockers

- In-memory rate limiting is soft on multi-instance serverless
- Homepage remains dynamic (ISR optional later)
- Live verification still depends on Tavily snippets (PAGE_METADATA fetch optional later)
