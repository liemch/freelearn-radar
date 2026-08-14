# M19 Final Report — Coverage, Truth & Time Intelligence

Status: **M19_CORE_COMPLETE** (feature flags default OFF; live STOP gates still apply)

Date: 2026-08-14  
Plan: `project-plan-v1.2.md`  
Architecture choice: **no monorepo** — monitor runs in the same Next.js app via `/api/cron/monitor` + `scripts/monitor-once.ts`.

---

## Execution order (as proposed)

1. URL shape classifier at ingest + path-scoped discovery queries  
2. M19.1 Truth (`provider_policies`, `free_durability`, FREE_TRIAL catalog guard)  
3. M19.0a Audit log on state changes  
4. M19.0b Review throughput (priority, auto-reject, expire stale, bulk API)  
5. M19.0c Admin entity pages (providers / queries / users / dashboard)  
6. M19.2 Topic tags  
7. M19.3–M19.7 Observations + events + monitor worker (in-repo)  
8. M19.8–M19.10 Tracker UI + watches + dry-run email (flagged)

---

## Shipped by milestone

### URL classifier (§67.5) — done first
- `src/domain/discovery/url-shape-classifier.ts`
- Wired into `ingestSearchResult` → `INVALID` / `NON_COURSE_PATTERN` before fetch/AI
- Rejects Microsoft Learn `/answers/**`, Coursera articles, Udemy topics, etc.
- Seed queries path-scoped (`site:learn.microsoft.com/training …`)

### M19.1 Truth
- `provider_policies` table + seed (Udemy / MS Learn / freeCodeCamp)
- `resolveCertificateWithPolicy` (§66.3 order)
- `deriveFreeDurability` on courses
- `FREE_WITH_COUPON` MANUAL-only (`assertPriceTypeAllowed`)
- Default catalog excludes `FREE_TRIAL` + `PAID`

### M19.0a Audit
- `admin_audit_log` + `writeAuditLog` (fail-soft)
- Wired: candidate approve/reject/reanalyze, course edit/status, discovery run, cron discover

### M19.0b Throughput
- Review priority sort + saved views (`?view=`)
- Deterministic auto-reject (URL shape / high-confidence non-course)
- `EXPIRED_UNREVIEWED` after 30 days (cron)
- Bulk API `/api/admin/candidates/bulk` (max 50)

### M19.0c Admin surfaces
- `/admin/providers`, `/admin/providers/[id]` + URL try box
- `/admin/discovery/queries` enable toggle
- `/admin/users` role management (ADMIN)
- Dashboard → clickable work list
- RBAC helpers `assertAdmin` / `assertEditor`

### M19.2 Taxonomy
- Topic tag sync from AI categories on approve
- `/{locale}/topic/[slug]` (≥8 courses or `FEATURE_TOPIC_PAGES`)
- `/admin/taxonomy` read-only

### M19.3–M19.7 Time (in-repo worker)
- `course_observations` append-only via `observeCourse` (reuses CourseSourceFetcher)
- `detectPriceEvents` with double-confirm; never from BLOCKED/TIMEOUT/ERROR
- `runMonitorBatch` + `/api/cron/monitor` every 6h + `scripts/monitor-once.ts`
- `FEATURE_AUTO_STATUS` gates writing price/cert onto courses

### M19.8–M19.10 UX / Alerts (flagged OFF)
- Tracker vocabulary + max 3 badges
- `/{locale}/tracker` + course detail watch form when `FEATURE_TRACKER_UI`
- Watches + DryRun/Resend email when `FEATURE_PRICE_ALERTS`

---

## Schema / migration

- `drizzle/0005_m19_coverage_truth_time.sql`
- Also reflected in `scripts/neon-bootstrap.sql`

**Deploy note:** Production builds run `npm run vercel-build` (= `db:migrate:run` → `db:seed` → `next build`) via `vercel.json` `buildCommand`. Migration `0005` applies automatically on the next main deploy when `DATABASE_URL` is set.

---

## Feature flags (default OFF)

```text
FEATURE_TOPIC_PAGES=
FEATURE_TRACKER_UI=
FEATURE_PRICE_ALERTS=
FEATURE_PUBLIC_FEED=
FEATURE_AUTO_STATUS=
EMAIL_DRY_RUN=true
MONITOR_DAILY_FETCH_BUDGET=50
```

---

## STOP gates (still binding for production enablement)

1. **STOP 1** — M19.0–M19.2 usable without new infra ✅ code complete  
2. **STOP 2** — run monitor 1 week observe-only; if Tier-1 BLOCKED > 40% → do not enable tracker  
3. **STOP 3** — replay real observations; false events → keep `FEATURE_TRACKER_UI` / alerts OFF  
4. Per-milestone quality: lint / typecheck / test / build

---

## Explicitly deferred (not blockers for M19_CORE)

- Monorepo split (`apps/web` + `apps/monitor`)
- Keyboard shortcuts in review queue
- Bulk undo from `before_json`
- Collections admin curator UI
- Taxonomy merge/rename UI
- Sparklines / free-streak charts / RSS
- Bounce webhook / watcher admin list
- Full Group-A provider onboarding with HTML fixtures for every new provider

---

## Quality gates (local)

Recorded at ship time — re-run after pull:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

---

## How to try

```bash
# After migrate + seed
FEATURE_TRACKER_UI=true FEATURE_PRICE_ALERTS=true EMAIL_DRY_RUN=true

# One monitor pass
npx tsx scripts/monitor-once.ts
```

Reject Microsoft Q&A URLs at ingest without AI.  
Review queue sorts by priority.  
Audit rows appear for approve/reject.  
Tracker/alerts stay dark until flags + STOP 2/3 cleared.
