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
- Every authenticated request re-reads the user row: a deleted user, a demoted
  role, or a bumped `users.session_version` takes effect on the next request
  instead of waiting out the 7-day token
- Admin → Users → **Revoke sessions** (`PATCH /api/admin/users/:id`
  `{"revokeSessions": true}`) forces one user to sign in again
- If the database is unreachable the check falls back to the token, so a Neon
  incident does not lock every operator out of the console

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
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Strict-Transport-Security`, `Content-Security-Policy`

### Content Security Policy

Enforced from `next.config.ts`. `script-src`/`style-src` still allow
`'unsafe-inline'` because the JSON-LD and locale scripts are inlined by the
server; moving to nonces would force every catalog page to render dynamically.
`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'` and
`form-action 'self'` are enforced with no such trade-off.

### Cron

- Fail-closed without `CRON_SECRET`
- Accepts `Authorization: Bearer` or `x-cron-secret`
- `/api/health` liveness is public; `/api/health?deep=1` needs the same cron
  credential whenever `CRON_SECRET` is configured

### Public write endpoints

- `POST /api/watches` is rate-limited per IP (10/h) and per email address (5/h),
  and answers opaquely so it cannot be used to probe which addresses or course
  ids exist

## Residual risks

| Risk | Severity | Notes |
|------|----------|-------|
| In-memory rate limit is per-instance | Medium | Soft protection on serverless |
| `'unsafe-inline'` in script-src/style-src | Medium | Nonces would force dynamic rendering |
| EDITOR vs ADMIN still shares course publish | Low | Intentional MVP split |
| Affiliate URL not domain-bound to provider | Medium | Admin trust model |
| Session check falls back to the token when the DB is down | Low | Availability chosen over instant revoke |
| `sharp`/`postcss` advisories inherited from Next 15 | Medium | Only clear on a Next 16 upgrade |

## Incident response notes

- Rotate `AUTH_SECRET` / `CRON_SECRET` / API keys immediately on leak
- Revoke one operator: Admin → Users → **Revoke sessions** (takes effect on
  their next request; deleting the user row has the same effect)
- Rotating `AUTH_SECRET` remains the "sign everybody out at once" lever
- Disable discovery via empty/disabled `discovery_queries` or remove Tavily key
