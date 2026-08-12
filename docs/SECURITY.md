# Security Review — FreeLearn Radar (M15)

## Threat model

Untrusted inputs:

- External search results (Tavily)
- External webpage snippets fed to NVIDIA
- Admin-entered URLs
- Query-string filters
- Cron callers

Trusted boundaries:

- Server-only secrets (`AUTH_SECRET`, API keys, `CRON_SECRET`)
- Admin JWT session cookie (`flr_session`, httpOnly)

## Controls implemented

### Authentication / Authorization

- Admin pages protected by middleware
- Admin APIs protected by middleware + route-level session checks
- Candidate approve/reject/reanalyze and discovery run require **ADMIN**
- Course CRUD allowed for ADMIN and EDITOR
- Login rate-limited (best-effort in-memory)
- Production requires `AUTH_SECRET` (≥32) and `CRON_SECRET` (≥16)

### Outbound redirects

- `/course/[slug]/go` validates destination with `assertSafeHttpUrl`
- Blocks `javascript:`, `data:`, `file:`, protocol-relative URLs
- Click recording failures do not block redirects

### External content / AI

- Prompt wraps content in `<external-content>` and instructs ignore-in-content
- AI JSON validated with Zod; malformed → `AI_PARSE_ERROR`
- AI never auto-publishes; human approval required
- Stored analysis re-parsed with Zod on approve

### Injection

- No raw HTML rendering of external content
- Drizzle parameterized queries
- Catalog keyword length capped

### SEO / indexing of private areas

- `robots.txt` disallows `/admin` and `/api/`
- Admin layout `robots: noindex`
- Response headers `X-Robots-Tag` for admin/API
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`

### Cron

- Fail-closed without `CRON_SECRET`
- Accepts `Authorization: Bearer` or `x-cron-secret`

## Residual risks

| Risk | Severity | Notes |
|------|----------|-------|
| In-memory rate limit is per-instance | Medium | Soft protection on serverless |
| Session not revoked on password change | Medium | 7-day JWT TTL |
| EDITOR vs ADMIN still shares course publish | Low | Intentional MVP split |
| Affiliate URL not domain-bound to provider | Medium | Admin trust model |
| Deep health requires DB credentials | Low | Opt-in `?deep=1` |

## Incident response notes

- Rotate `AUTH_SECRET` / `CRON_SECRET` / API keys immediately on leak
- Revoke admin access by removing user row + rotating `AUTH_SECRET`
- Disable discovery via empty/disabled `discovery_queries` or remove Tavily key
