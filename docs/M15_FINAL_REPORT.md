# M15 Final Report — Production Hardening & Engineering Review

Date: 2026-08-13  
Scope: Full repository after WP0–WP14  
Git: **not committed / not pushed** (per overnight rules)

## Verdict

**READY_FOR_LIVE_INTEGRATION**

Code and quality gates are ready for Neon + Tavily + NVIDIA + Vercel wiring. Live credentials and deploy remain pending.

---

## Architecture review

- Clear layering: App Router → domain services → repositories → Drizzle.
- External I/O isolated behind `SearchProvider` / `AIProvider`.
- Human-in-the-loop approval remains the only publish path; AI never auto-publishes.
- Remaining MVP debt: approve creates `PUBLISHED` immediately (intentional); `course_verifications` reserved but unused.

## Security review

Fixed / verified:

- Outbound URL protocol allowlist (`http`/`https` only)
- Production secret enforcement (`AUTH_SECRET` ≥32, `CRON_SECRET` ≥16)
- Middleware + route guards for `/admin` and `/api/admin`
- ADMIN-only for discovery run + candidate approve/reject/reanalyze
- Cron fail-closed auth
- Login soft rate limit
- Security headers + admin/API `noindex`
- Prompt wrapping + Zod validation of AI output
- No secrets in `.env.example`

See `docs/SECURITY.md`.

## Database review

- Append-only migrations: `0000_initial_schema`, `0001_add_query_indexes`
- Indexes added for actual query patterns (status, discovery due, clicks)
- Approve path re-checks uniqueness inside transaction and fails without provider fallback
- Catalog page capped (`MAX_PAGE`)

## Reliability review

- Tavily/NVIDIA timeout + 401/429/500 mocked failure paths
- Malformed / incomplete / hallucinated AI JSON rejected
- Discovery batch isolates per-query failures
- `/go` continues redirect if click insert fails
- Deep health: `/api/health?deep=1`

## Test improvements

Added/expanded coverage for:

- URL safety / outbound fallback
- Candidate approve gates + provider resolution
- Course status transitions
- Rate limit
- Cron auth
- Prompt injection sanitization
- Provider HTTP error resilience
- Course form unsafe URL rejection

## UX / a11y / SEO / performance

- Shared `EmptyState` + `SiteFooter` on public pages
- Free status visually prioritized over AI score on cards/detail
- Mobile header menu with ARIA
- Non-published course metadata `noindex`; expired/draft → `notFound` on public route
- Admin robots noindex (layout + headers)
- Bound catalog pagination; no speculative ISR rewrite

## Dependency audit

`npm audit --omit=dev` reports high advisories in transitive/stack packages:

| Package | Notes | Action taken |
|---------|-------|--------------|
| `drizzle-orm` `<0.45.2` | Identifier escaping advisory; force upgrade is breaking | **Deferred** — no force upgrade; monitor; queries use parameterized values |
| `next` → `postcss` / `sharp` | Force fix pulls Next 16 | **Deferred** — major upgrade out of M15 scope |

No unused direct dependencies removed (all listed packages used). No blind force fixes applied.

---

## Findings fixed

### Critical
- Outbound unsafe-scheme redirects
- Optional production secrets
- Approve status gating + transactional uniqueness hardening
- Provider fallback removed

### High
- Admin API middleware coverage
- Login rate limiting
- ADMIN vs EDITOR privilege split for discovery/approve
- Query indexes + discovery `next_run_at` filter
- Click-failure no longer blocks redirect
- Draft/expired metadata leak
- Deep health check

### Medium
- Catalog page bound
- Admin/API noindex
- Course form http(s) URL validation
- Public empty states / free-status hierarchy

### Low
- Security headers
- Env production test typing fix
- Health deep contract docs/tests

---

## Tests before / after

| Metric | Before M15 | After M15 |
|--------|------------|-----------|
| Tests | 53 | **75** |
| Test files | ~20 | 23 |

## Quality gates

| Gate | Result |
|------|--------|
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run test` | **PASS** (75) |
| `npm run build` | **PASS** |

---

## Remaining technical debt

1. In-memory rate limit is soft on multi-instance serverless
2. Session revocation requires `AUTH_SECRET` rotation
3. `course_verifications` unused until verification cron WP
4. Homepage remains fully dynamic (no ISR yet)
5. Deferred major upgrades for drizzle/next audit advisories
6. Ranking sort differs slightly between homepage scorer and catalog SQL sorts (documented)

## Pending live verification

Follow `docs/LIVE_INTEGRATION_CHECKLIST.md` steps 1–19 (Neon, migrations, Tavily, NVIDIA, cron, Vercel smoke).

## Production blockers

**None in code for live integration.**  
Blockers are operational only: missing real `DATABASE_URL`, API keys, and deploy credentials.

## Final recommendation

**READY_FOR_LIVE_INTEGRATION**

Deliverables:

- `docs/ENGINEERING_REVIEW.md`
- `docs/SECURITY.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/LIVE_INTEGRATION_CHECKLIST.md`
- `docs/M15_FINAL_REPORT.md`

**STOP.** No commit, no push, no deploy.
