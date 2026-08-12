# Live Integration Checklist

Distinguish:

- **AUTOMATED VERIFIED** — covered by unit/integration tests + local quality gates
- **PENDING LIVE VERIFICATION** — requires real Neon/Tavily/NVIDIA/Vercel

## Steps for tomorrow

1. **Create PostgreSQL/Neon database** — PENDING LIVE VERIFICATION
2. **Configure `DATABASE_URL`** in `.env` / Vercel — PENDING LIVE VERIFICATION
3. **Run migrations** `npm run db:migrate:run` — PENDING LIVE VERIFICATION  
   (SQL artifacts AUTOMATED VERIFIED in repo)
4. **Run seed** `npm run db:seed` — PENDING LIVE VERIFICATION  
   (seed script AUTOMATED VERIFIED)
5. **Verify DB schema** (tables/enums/indexes present) — PENDING LIVE VERIFICATION
6. **Configure Tavily** `TAVILY_API_KEY` — PENDING LIVE VERIFICATION  
   (adapter + mocks AUTOMATED VERIFIED)
7. **Perform one real Tavily search** via `/admin/discovery` — PENDING LIVE VERIFICATION
8. **Verify Candidate creation** in `/admin/candidates` — PENDING LIVE VERIFICATION
9. **Configure NVIDIA** `NVIDIA_API_KEY` (+ model/base URL) — PENDING LIVE VERIFICATION  
   (adapter + Zod parse AUTOMATED VERIFIED)
10. **Analyze one real Candidate** (Re-analyze) — PENDING LIVE VERIFICATION
11. **Verify structured AI response** stored in candidate JSON — PENDING LIVE VERIFICATION
12. **Approve Candidate** (ADMIN) — PENDING LIVE VERIFICATION  
    (domain approve tests AUTOMATED VERIFIED)
13. **Verify published Course** in `/admin/courses` — PENDING LIVE VERIFICATION
14. **Verify public page** `/course/[slug]` — PENDING LIVE VERIFICATION
15. **Verify outbound redirect** `/course/[slug]/go` — PENDING LIVE VERIFICATION  
    (URL safety AUTOMATED VERIFIED)
16. **Verify Cron manually**  
    `curl -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/discover"` — PENDING LIVE VERIFICATION  
    (cron auth AUTOMATED VERIFIED)
17. **Verify production build** `npm run build` — AUTOMATED VERIFIED in M15 gate
18. **Deploy Vercel** — PENDING LIVE VERIFICATION / `PENDING_MANUAL_DEPLOYMENT`
19. **Run production smoke tests** (health, login, one course click) — PENDING LIVE VERIFICATION

## Automated verified today (M15)

- Lint / typecheck / unit tests / build
- URL normalization + unsafe scheme rejection
- Candidate approve status gates + provider resolution
- Ranking / pricing / certificate helpers
- Cron auth fail-closed
- Login rate-limit unit behavior
- AI malformed JSON handling
- Discovery batch failure isolation (mocked)
- Security headers + admin noindex config present in code
