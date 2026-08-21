# FreeLearn Radar

A discovery engine for genuinely free online courses. It searches the web,
analyses each candidate with an LLM, makes a human approve it, then keeps
watching the published page so the catalog does not quietly rot into a list of
courses that stopped being free.

It is **not** an LMS and hosts no course content — every course links back to
the provider.

## What the system actually does

```text
Tavily search → candidate → source fetch → AI analysis → admin review
      → published course → scheduled re-observation → price/status events
```

Two rules shape most of the code:

- **Truth over volume.** A course is published only after a human approves it,
  and every claim ("free", "free certificate") is backed by stored evidence.
- **Flags default off.** Semantic search, price alerts, coupons, monetization
  and the rest are runtime kill switches read per request, not build-time
  constants, so a bad day is one env change away from being over.

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 15 App Router (RSC), TypeScript, Tailwind 4 |
| Data | Neon Postgres via Drizzle ORM, append-only SQL migrations |
| Jobs | Vercel Cron → `/api/cron/*`, authenticated with `CRON_SECRET` |
| AI | NVIDIA NIM (analysis, embeddings) |
| Search | Tavily |
| Mail | Resend (dry-run by default) |
| Media | Cloudflare R2 (optional; Postgres holds metadata) |

Node 22+ is required.

## Getting started

```bash
cp .env.example .env.local     # fill DATABASE_URL, AUTH_SECRET, APP_URL
npm install
npm run db:migrate:run
npm run db:seed                # providers, categories, discovery queries, admin user
npm run dev
```

The seed creates admin accounts from `ADMIN_EMAILS` with
`ADMIN_BOOTSTRAP_PASSWORD`. Change the password after the first login. Sample
courses are local-only and never seeded on a production runtime.

Behind a firewall that blocks port 5432, use `npm run db:migrate:http` and
`npm run db:seed:http`. As a last resort, paste `scripts/neon-bootstrap.sql`
into the Neon SQL editor.

## Everyday commands

```bash
npm run dev            # next dev --turbopack
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run test           # vitest run
npm run build          # production build

npm run monitor:once   # run one monitor pass locally
npm run replay:events  # replay observations, prove event detection is quiet
npm run verify:db      # migration/search/coupon/media checks against a real DB
```

## Layout

```text
src/app/            routes — public catalog, /admin console, /api (BFF + cron)
src/domain/         business rules (discovery, candidate, monitor, coverage…)
src/db/             drizzle schema, repositories, migrations entrypoint, seed
src/services/       outbound integrations (ai, search, fetch, email, storage)
src/lib/            env parsing, auth, i18n, logging, rate limiting
drizzle/            append-only SQL migrations + journal
scripts/verify/     end-to-end verification scripts
docs/               audit reports, security notes, milestone reports
```

Layering rule: `app → domain → db/services`. Route handlers stay thin; business
rules never import `next/*`; outbound calls go through a service so they can be
faked in tests.

## Operations

- `GET /api/health` — public liveness
- `GET /api/health?deep=1` — adds a `SELECT 1`, requires the cron credential
- Cron schedule, env table and migration list: `docs/PRODUCTION_READINESS.md`
- Security posture and incident playbook: `docs/SECURITY.md`
- Current state of the codebase, hotspots and open work: `docs/audit/`

Every metered outbound call (Tavily, NVIDIA, Resend, page fetches) writes an
`api_usage_log` row, so cost and failure rates are queryable from the database.

## Contributing

Before pushing: `npm run lint && npm run typecheck && npm run test`. Schema
changes need a new `drizzle/00XX_*.sql`, a journal entry, and a regenerated
`scripts/neon-bootstrap.sql` (`npm run db:bootstrap:generate`).
