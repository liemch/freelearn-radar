# Production Readiness (WP14)

Status: `PENDING_MANUAL_DEPLOYMENT`

This document covers production readiness for FreeLearn Radar. It does **not**
perform deployment. Humans must provision external resources.

## Required environment variables

```bash
DATABASE_URL=
AUTH_SECRET=                 # >= 32 chars
ADMIN_EMAILS=
ADMIN_BOOTSTRAP_PASSWORD=
APP_URL=                     # https://your-domain.example

TAVILY_API_KEY=              # discovery search
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3-super-120b-a12b

CRON_SECRET=                 # required for /api/cron/discover

DISCOVERY_QUERY_LIMIT=15
DISCOVERY_RESULT_LIMIT=5
AI_ANALYSIS_LIMIT=30
```

Never prefix secrets with `NEXT_PUBLIC_`.

## Database

1. Create a Neon (or other) PostgreSQL database.
2. Set `DATABASE_URL`.
3. Run migrations:

```bash
npm run db:migrate:run
```

4. Seed reference data (providers, categories, discovery queries, admin users):

```bash
npm run db:seed
```

The sample courses bundled with the seed are development fixtures. They are refused on any
production runtime and require `SEED_SAMPLE_COURSES=true` locally, so a production catalog only
ever contains courses a human approved (project plan Rule 9).

## Local smoke

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev
```

Checks:

- `/` renders
- `/api/health` returns `{ status: "ok" }`
- `/admin/login` works with seeded admin
- Manual course create/publish works without AI
- `/course/[slug]/go` redirects and records click when DB is available

## Live integration (manual)

Marked as `PENDING_MANUAL_INTEGRATION_TEST` until keys exist:

1. Configure `TAVILY_API_KEY`
2. Run discovery from `/admin/discovery`
3. Configure `NVIDIA_API_KEY`
4. Re-analyze a candidate
5. Approve candidate and confirm public course page
6. Call cron:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/discover"
```

## Vercel deployment checklist

1. Import GitHub repo into Vercel
2. Set all environment variables above
3. Ensure `vercel.json` cron is present (`/api/cron/discover` daily)
4. Deploy
5. Run migrate + seed against production DB from a trusted machine
6. Verify `/api/health`
7. Verify cron auth rejects missing secret
8. Spot-check SEO routes: `/sitemap.xml`, `/robots.txt`, `/best/YYYY/MM`

## Notes

- AI output never auto-publishes.
- Candidate approval is human-in-the-loop.
- External webpage content is treated as untrusted input.
