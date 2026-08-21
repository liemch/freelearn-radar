# Production Readiness — FreeLearn Radar

Status: **READY_WITH_REMEDIATION** (code/config). The engine, admin console and
cron chain are in place; what is still unproven is live operation — catalog
growth, monitor accuracy on real providers, and the feature flags that are
deliberately still off. See `docs/audit/05-summary.md` for the open list.

## Environment variables

Full list with inline notes: `.env.example`. The ones that decide whether a
deploy works at all:

| Variable | Required locally | Required production | Notes |
|----------|------------------|---------------------|-------|
| `DATABASE_URL` | yes | yes | Neon/Postgres; prefer the `-pooler` URL |
| `DATABASE_POOL_MAX` | optional | optional | Default 10 per instance |
| `APP_URL` | yes | yes | Public origin |
| `AUTH_SECRET` | recommended | **yes (≥32)** | Enforced when `NODE_ENV=production` or Vercel |
| `CRON_SECRET` | recommended | **yes (≥16)** | Cron auth + `/api/health?deep=1` |
| `ADMIN_EMAILS` | for seed | for seed | Comma-separated |
| `ADMIN_BOOTSTRAP_PASSWORD` | for seed | for seed | Change after first login |
| `TAVILY_API_KEY` | for discovery | for discovery | Discovery fails closed without it |
| `NVIDIA_API_KEY` | for AI | for AI | Analysis fails closed without it |
| `NVIDIA_MODEL` | optional | optional | Default `nvidia/nemotron-3-super-120b-a12b` |
| `MONITOR_ENABLED` | optional | optional | `false` stops all outbound observation without a redeploy |
| `MONITOR_DAILY_FETCH_BUDGET` | optional | optional | Default 50 fetches/run |
| `MONITOR_OBSERVED_REGION` | optional | optional | Observations are only compared within one region |
| `EMAIL_DRY_RUN` | optional | **keep `true` until deliverability is proven** | Alerts log instead of sending |
| `RESEND_API_KEY` | for alerts | for alerts | Only used when `EMAIL_DRY_RUN=false` |
| `EMAIL_DAILY_BUDGET` | optional | optional | Default 500 sends |
| `RELEVANCE_FLOOR` | optional | optional | Blank keeps search lexical-only even if semantic flags are on |
| `FEATURE_*` | optional | optional | All default OFF; runtime kill switches, not build-time constants |
| `R2_*` | for object storage | for object storage | Unset keeps media in Postgres |

Never use `NEXT_PUBLIC_` for secrets.

## Commands

```bash
npm install
npm run db:migrate:run     # or db:migrate:http behind a firewall
npm run db:seed
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev
```

Verification scripts (need a reachable Postgres, see `scripts/verify/`):

```bash
npm run verify:db          # migrations, search, coupon, media
npm run verify:http        # HTTP-level checks against a running app
npm run verify:flags-on    # behaviour with feature flags enabled
```

## Health

- `GET /api/health` → liveness, public, no database access
- `GET /api/health?deep=1` → liveness + `SELECT 1`, **requires the cron
  credential** (`Authorization: Bearer $CRON_SECRET` or `x-cron-secret`)
  whenever `CRON_SECRET` is set; 503 when the database is down

## Cron

`vercel.json` schedules six jobs, all authenticated with `CRON_SECRET`:

| Path | Schedule (UTC) | Purpose |
|------|----------------|---------|
| `/api/cron/discover` | `0 6 * * *` | Discovery + source fetch + AI analysis |
| `/api/cron/discover` | `0 12 * * *` | Second discovery pass |
| `/api/cron/verify` | `0 18 * * *` | Re-verify published courses |
| `/api/cron/monitor` | `0 2 * * *` | Observe courses, detect price events |
| `/api/cron/embed` | `0 4 * * *` | Embedding backfill (no-op while flags are off) |
| `/api/cron/coupons` | `0 21 * * *` | Coupon discovery + bounded media resolution |

Header: `Authorization: Bearer $CRON_SECRET`.

## Migrations

Append-only, applied in `drizzle/meta/_journal.json` order — currently
`0000_initial_schema` through `0017_session_revocation` (18 files). `vercel-build`
runs `db:migrate:run` then `db:seed` on every deploy, both idempotent.

`scripts/neon-bootstrap.sql` is a generated fallback for pasting into the Neon
SQL editor when a deploy cannot run migrations. Regenerate it with
`npm run db:bootstrap:generate` after adding any migration — never edit it by
hand.

## Cost / usage visibility

Every metered outbound call writes one `api_usage_log` row: `search` (Tavily),
`ai_analysis` (NVIDIA), `embedding`, `source_fetch`, `monitor_fetch`, and
`email` (Resend, including dry runs). Group by `kind` to see spend without
leaving the database.

## Security posture (summary)

See `docs/SECURITY.md`.

## Known non-blockers

- In-memory rate limiting is soft on multi-instance serverless
- `sharp`/`postcss` advisories are inherited from Next 15 and only clear with a
  Next 16 upgrade; CI reports them and blocks only on critical findings
- Monitor observations do not use ETag/If-None-Match yet, so unchanged pages are
  re-downloaded in full
- Live verification still leans on Tavily snippets where provider policy forbids
  a full fetch
