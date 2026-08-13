# Manual Morning Checklist

Use this after the overnight WP5–WP14 code completion.

## 1. Provision database
- [ ] Create Neon PostgreSQL project
- [ ] Copy connection string into local `.env` as `DATABASE_URL`

## 2. Configure environment
- [ ] Copy `.env.example` → `.env`
- [ ] Set `AUTH_SECRET` (>= 32 chars)
- [ ] Set `ADMIN_EMAILS` and `ADMIN_BOOTSTRAP_PASSWORD`
- [ ] Set `APP_URL=http://localhost:3000` for local
- [ ] Optionally set `TAVILY_API_KEY`, `NVIDIA_API_KEY`, `CRON_SECRET`

## 3. Migrate database
```bash
npm run db:migrate:run
```

## 4. Seed database
```bash
npm run db:seed
```
Reference data only. To also load the local sample courses, run it with
`SEED_SAMPLE_COURSES=true`; the flag is ignored on production runtimes.

## 5. Configure Tavily
- [ ] Add `TAVILY_API_KEY`
- [ ] Open `/admin/discovery` and run discovery
- [ ] Confirm candidates appear

## 6. Configure NVIDIA
- [ ] Add `NVIDIA_API_KEY` (+ model/base URL if needed)
- [ ] Re-analyze a candidate from `/admin/candidates/[id]`
- [ ] Confirm analysis JSON is stored

## 7. Run application
```bash
npm run dev
```

## 8. Live integration smoke tests
- [ ] Admin login
- [ ] Manual course create/publish
- [ ] Discovery run
- [ ] Candidate approve → public course visible
- [ ] `/course/[slug]/go` redirects to provider
- [ ] Cron endpoint with `Authorization: Bearer $CRON_SECRET`

## 9. Inspect UI manually
- [ ] `/` sections render ranked courses
- [ ] `/search` filters work
- [ ] `/category/[slug]` works
- [ ] `/best/YYYY/MM` works
- [ ] `/admin` analytics/navigation works

## 10. Deploy Vercel
- [ ] Follow `docs/PRODUCTION.md`
- [ ] Set production env vars
- [ ] Deploy
- [ ] Migrate + seed production DB
- [ ] Verify health + cron + SEO endpoints
