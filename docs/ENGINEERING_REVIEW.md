# Engineering Review — M15 Production Hardening

Date: 2026-08-13  
Scope: Full repository after WP0–WP14  
Status: Remediation completed during M15 (see `docs/M15_FINAL_REPORT.md`)

## Summary

Solid MVP architecture with provider adapters, human-in-the-loop approval, and strong unit coverage. Production blockers cluster around outbound redirect safety, approve race conditions, production secret enforcement, missing DB indexes, and weak server-side state gates.

## Findings

### CRITICAL

| ID | Finding | Location | Remediation |
|----|---------|----------|-------------|
| C-SEC-1 | Outbound `/go` redirects without runtime URL protocol validation | `course/[slug]/go`, `buildOutboundUrl` | Validate http(s) before redirect; reject unsafe schemes |
| C-SEC-2 | `AUTH_SECRET` / `CRON_SECRET` optional at startup | `lib/env.ts` | Require in production (`VERCEL`/`NODE_ENV=production`) |
| C-DOM-1 / race | Approve duplicate check outside transaction (TOCTOU) | `approve-candidate.ts` | Lock checks inside transaction; catch unique violations |
| C-DOM-2 | Approve API allows non-reviewable candidate statuses | `approve-candidate.ts` | Gate to `READY_FOR_REVIEW` / `ANALYZED` only |

### HIGH

| ID | Finding | Remediation |
|----|---------|-------------|
| H-SEC-1 | Middleware does not cover `/api/admin` | Extend matcher + keep route guards |
| H-SEC-2 | No login rate limiting | In-memory rate limiter for login |
| H-SEC-3 | ADMIN vs EDITOR not differentiated | Restrict discovery/approve to ADMIN |
| H-DB-1 | Missing indexes for status/discovery/clicks | Migration `0001_add_query_indexes` |
| H-DB-2 | Discovery ignores `next_run_at` | Filter due queries |
| H-DOM-2 | Override slug uniqueness not checked | Validate before insert |
| H-DOM-3 | Provider fallback to `providers[0]` | Fail if unresolved |
| H-DOM-4 | No course status transition map | Enforce allowed transitions |
| H-ERR-1 | Click record failure blocks outbound redirect | Redirect even if click insert fails |
| H-SEO-1 | Draft course metadata can leak | Guard `generateMetadata` by status |
| H-PERF-1 | Homepage always force-dynamic | Keep dynamic (DB-backed) but bound queries |
| H-CFG-1 | Health never checks DB | Optional deep health |

### MEDIUM

| ID | Finding | Remediation |
|----|---------|-------------|
| M-ARCH-1 | Ranking differs home vs search | Document; align recommended sort notes |
| M-ARCH-2 | `withDb` masks outages as empty | Log already; add health deep check |
| M-DB-2 | Unbounded catalog page | Cap page size/page |
| M-SEO-1 | Admin pages lack robots noindex meta | Admin layout metadata |
| M-ERR-1 | Empty catches without logging | Add logger.warn |
| M-DOM-1 | `ANALYZED` status never set | Treat as synonym or map to READY |
| Dead schema | `course_verifications` unused | Keep for WP roadmap; document debt |
| Unused exports | Several repository helpers | Leave for future WP; document |

### LOW

| ID | Finding | Remediation |
|----|---------|-------------|
| L-SEC-1 | No security headers | Add in `next.config.ts` |
| L-ARCH-1 | Unused `requireSession` helpers | Wire into admin APIs |
| Magic numbers | Ranking weights / timeouts | Document in code comments |
| L-SEO | Relative canonicals | Acceptable with APP_URL |

## Architecture Notes

- Search/AI calls are behind providers (good).
- Domain services exist for discovery/approve/ranking (good).
- API handlers still compose concrete factories — acceptable for MVP; composition root optional.

## Out of Scope This Pass

- Live Tavily / NVIDIA / Neon verification
- Vercel production deploy
- Major dependency upgrades
- Implementing full verification/expiry cron (schema reserved)

## Decision Log

1. Approve remains human-triggered publish for MVP (explicit approve = publish), but status gate hardened.
2. Rate limiting is in-process (best-effort on serverless); document as soft limit.
3. EDITOR can manage courses; ADMIN-only for discovery run + candidate approve/reject.
