# v1.2 Remediation — Implementation Report

Implements `docs/V1_2_REMEDIATION_PLAN.md`, which addresses the findings in
`docs/V1_2_PRODUCTION_AUDIT.md`.

**Scope completed:** R1 (all), R2 (all), R3 (all except two items noted below).
R4 remains backlog and was not started.

**Quality gates:** lint PASS (2 pre-existing warnings, unchanged) · typecheck PASS ·
test PASS (364 tests, up from 322) · build PASS.

**Still requires the operator:** R0.1 — confirm `FEATURE_AUTO_STATUS` and
`FEATURE_PRICE_ALERTS` are absent or `false` in the Vercel production
environment. Code defaults are off, but the deployed values cannot be read from
the repository.

---

## R1 — Must fix before M20

### R1.1 · `FREE_TRIAL` leak paths — `TRU-01`

The exclusion was an `else if`, so any explicit `?price=` filter disabled it.
It is now applied *alongside* the filter, not instead of it, and the accepted
values for the public `price` parameter no longer include `FREE_TRIAL` or `PAID`
at all — a hand-typed value is dropped at parse time rather than producing a
free-labelled page with zero results.

The audit named three leak paths; a fourth was found during implementation: the
homepage calls `listPublishedCoursesWithProvider`, which had no price predicate.
That function now excludes non-free prices by default, so a future caller is safe
by construction. Verification opts out explicitly, since it must still re-check
courses that have gone paid.

`FREE_LIST_EXCLUDED_PRICE_TYPES` in `src/domain/course/free-durability.ts` is now
the single source of truth for all four surfaces.

- `src/db/repositories/course-repository.ts` — catalog SQL, published list
- `src/domain/course/catalog-query.ts` — public filter parsing
- `src/domain/taxonomy/topic-tags.ts` — topic pages
- `src/domain/verification/verify-batch.ts` — explicit opt-out

### R1.2 · Database-backed provider policies — `TRU-02`, `TRU-03`

`resolveCertificateWithPolicy` fell back to a hardcoded constant, so the admin
policy UI was inert and `effective_from` was never honoured. Both call sites now
load rules from `provider_policies` via the new
`src/db/repositories/provider-policy-repository.ts`, and the resolver skips rules
that are inactive or not yet effective.

The missing Coursera and edX `FREE_AUDIT → PAID_CERTIFICATE` rules were added to
the seed set.

`assertCertificateResolved` rejects `FREE_AUDIT` paired with an `UNKNOWN`
certificate at approval time. It deliberately does not guess: filling in
`PAID_CERTIFICATE` for an unrecognised provider would assert something the system
has no evidence for. Provider policy covers the known cases; anything else is
raised to the reviewer, who is present at that moment and can answer it.

### R1.3 · Audit coverage — `MON-01`, `AUD-01`

Three previously silent write paths now produce audit records:

| Path | Actor | Action |
|---|---|---|
| `detect-events.ts` event insert | `WORKER` | `PRICE_EVENT_DETECTED` |
| `detect-events.ts` auto-status | `WORKER` | `COURSE_AUTO_STATUS` (with `before`) |
| `verify-batch.ts` course update | `CRON` | `COURSE_VERIFICATION_UPDATE` (with `before`) |
| `analyze-candidate.ts` classification | `AI` | `CANDIDATE_ANALYZED` |

---

## R2 — Before enabling tracker and alerts

### R2.1 · Event confirmation rules — `EVT-01`

`confirmTransitionsFromObservations` previously checked only the count of
agreeing observations. It now applies all four §69.3 conditions:

- **Spacing** — consecutive observations must be ≥2h apart. Without this, a
  retry or a CDN cache flap yields three "consecutive" reads minutes apart, and a
  flash sale confirms as a durable transition.
- **Evidence** — `extraction_method` and `confidence` are now carried into the
  comparison. Every observation must be deterministic (`JSON_LD`, `OG`,
  `HTML_META`, `PROVIDER_API`, `MANUAL`, `POLICY`) or a high-confidence
  inference (≥0.8), and at least one must be deterministic. `SEARCH` counts as
  inference: a search snippet is a claim about the page, not a reading of it.

### R2.2 · Region guard — `EVT-02`

`observed_region` was never written, and `sameRegion` treated `null === null` as
a match, so the guard passed vacuously for every production observation. The
worker now stamps `MONITOR_OBSERVED_REGION`, and an unknown region no longer
matches anything — two nulls may be two different countries.

**Consequence:** observations recorded before this change carry no region and can
never confirm an event. The monitor must build fresh history before the STOP 3
replay means anything. `npm run replay:events` warns when this is the case.

### R2.3 · Auto-status guards — `TRU-04`, `EVT-04`

Auto-status wrote `toState.priceType` directly, so coupon wording on a page could
set a value §65.4 reserves for manual entry. It now passes through
`assertPriceTypeAllowed("SEARCH", …)` and logs a warning when it declines.
`CERT_CHANGED` no longer writes to the course row at all — it is not in the
permitted transition set, so a certificate flip goes to a human.

### R2.4 · Event idempotency — `DAT-01`

Deduplication was a SELECT followed by an INSERT with nothing between them, so
two concurrent workers could both pass the cooldown check. Migration `0006` adds
a partial unique index on `(course_id, event_type, date_trunc('day', confirmed_at))`
for confirmed rows. `insertPriceEvent` uses `ON CONFLICT DO NOTHING` and returns
`null` on rejection; the caller treats that as "already recorded".

### R2.5 · `isPublic` — `TRK-01`

Hardcoded `false` at insert while the public reader filtered for `true`, which
made the tracker feed permanently empty by construction. An event is now public
when its course is `PUBLISHED` and the type is visitor-actionable
(`WENT_FREE`, `WENT_PAID`, `DELISTED`, `RETURNED`). Events on unpublished courses
stay internal.

### R2.6 · Public watch surface — `SEC-01`, `SEC-02`, `SEC-03`

- **Rate limiting** — two buckets per hour: 10 per IP, 5 per email address. The
  second matters because one attacker spread across addresses could otherwise
  still flood a single inbox.
- **Response shape** — every outcome returns `{ ok: true }`, including
  "already subscribed" and "course not found". The previous response disclosed
  whether an arbitrary address watched a given course.
- **Confirm token** — stored as a SHA-256 digest with a 48-hour TTL. A database
  read now yields no working confirmation link.
- **Unsubscribe token** — no longer stored at all. It is derived per watch via
  HMAC over the watch id, so the link stays valid for the life of the
  subscription while the database holds no credential. Links carry `?w=<id>&t=<token>`.
- RFC 8058 `List-Unsubscribe` headers and a one-click `POST` handler were added
  while the surrounding code was open (this was an R4 item).

**Compatibility:** tokens issued before this release no longer validate. Price
alerts have never been enabled in production (`FEATURE_PRICE_ALERTS` off,
`EMAIL_DRY_RUN` on), so no delivered link is affected.

### R2.7 · STOP 3 replay — `EVT-05`

`npm run replay:events -- --days=30` replays stored observations through the
*same* pure confirmation function the worker uses, and reports what would have
fired. It is strictly read-only: no HTTP request, no row written, no email sent.

A replay that reimplemented the rules would prove nothing about production
behaviour, which is why it shares the function rather than mirroring it.

---

## R3 — Operability

**Worker controls (`MON-02`).** Per-domain rate limiting
(`MONITOR_PER_DOMAIN_RPM`, default 20/min) — concurrency alone does not bound
this, since two workers on different Coursera courses still hit coursera.org back
to back. Kill switch via `MONITOR_ENABLED=false`, so an operator can stop
outbound traffic without a redeploy. The hardcoded User-Agent moved to
`MONITOR_USER_AGENT` and now carries a contact URL, as §76 requires.

**Environment completeness.** Added `MONITOR_PER_DOMAIN_RPM`,
`MONITOR_USER_AGENT`, `MONITOR_OBSERVED_REGION`, `MONITOR_ENABLED`,
`EMAIL_REPLY_TO`, `EMAIL_DAILY_BUDGET`, `EMAIL_REQUEST_TIMEOUT_MS`. Added upper
bounds to `MONITOR_CONCURRENCY` and `MONITOR_DAILY_FETCH_BUDGET`: these govern
traffic to third-party sites, and a mistyped value should fail validation rather
than hammer a provider. Documented the full M19 set in `.env.example` and
`scripts/vercel-setup.sh`.

**`DISCOVERY_QUERY_LIMIT`.** Aligned to the spec value of 25 across `env.ts`,
`.env.example`, `PRODUCTION.md`, `PRODUCTION_READINESS.md`, and `vercel-setup.sh`.

**Bootstrap drift (`DAT-02`).** `scripts/neon-bootstrap.sql` is now generated
from the migration chain by `npm run db:bootstrap:generate`, rather than
hand-maintained. The previous file was missing migrations `0003` and `0004`
entirely while recording hashes that claimed the database was current — so a
database created from it lacked the course image and candidate source-fetch
columns and would not be repaired by the next deploy. All 7 migrations and all 7
hashes are now included.

**Resend timeout (`SEC-06`).** `AbortController` with `EMAIL_REQUEST_TIMEOUT_MS`,
plus a per-batch `EMAIL_DAILY_BUDGET` so one popular course going free cannot
exhaust the sending quota.

**Indexes (`DAT-03`).** Migration `0006` adds the `confirmed_at DESC` composite
matching the tracker's ordering, and indexes both watch token columns.

**`FEATURE_PUBLIC_FEED`.** Removed. It gated an RSS feed and
`/api/public/events` that do not exist; a flag that gates nothing reads as a
shipped feature that has been switched off.

### Not implemented in R3

- **Conditional requests (`etag`).** §76 assumes roughly 60% bandwidth saving
  from `If-None-Match`; the column exists and is always null. Bandwidth only, no
  correctness impact.
- **`api_usage_log` coverage (`MON-03`).** Still monitor-only. Tavily, NVIDIA,
  Resend, candidate source fetch, and image fetch remain unlogged, so no budget
  view can be built yet.

---

## Migration

`drizzle/0006_v12_remediation.sql` — additive and idempotent. No table rewrite,
no data loss, safe to re-run. Applied automatically by `vercel-build`.

## Tests added

| Area | File | Count |
|---|---|---|
| Free-list exclusion and filter parsing | `db/repositories/catalog-sql.test.ts` | +6 |
| DB policies, `effective_from`, `FREE_AUDIT` guard | `domain/verification/provider-policy.test.ts` | +10 |
| Spacing, region, evidence, idempotency, `isPublic`, auto-status | `domain/monitor/detect-events.test.ts` | +13 |
| Token hashing, TTL, HMAC derivation | `domain/alerts/watch-token-security.test.ts` | +11 |
| Replay | `domain/monitor/replay-events.test.ts` | +4 |
| Per-domain rate limiting | `domain/monitor/domain-rate-limiter.test.ts` | +6 |

## Recommended order before enabling anything

1. Confirm the two production flags are off (R0.1).
2. Deploy. Migration `0006` applies during `vercel-build`.
3. Set `MONITOR_OBSERVED_REGION` to match the deployment's egress market.
4. Let the monitor build at least three region-stamped observations per course.
5. Run `npm run replay:events -- --days=30` and require zero unexplained events.
6. Only then consider `FEATURE_TRACKER_UI`, then `FEATURE_PRICE_ALERTS`, then
   `FEATURE_AUTO_STATUS`.
