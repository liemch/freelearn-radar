# Runtime verification harness

Exercises real runtime paths against a **real Postgres**, with no Docker and no
production credentials.

Earlier review passes could only inspect the database statically because no
Postgres was reachable locally. This harness closes that gap by running
[PGlite](https://pglite.dev) — Postgres compiled to WASM — with the same
extensions production needs (`unaccent`, `pg_trgm`, `vector`), applying the real
`drizzle/*.sql` migrations, and then calling the application's own repositories,
domain services and HTTP routes.

Verification-only. Nothing here is imported by application code, and the three
PGlite packages are `devDependencies`.

## What runs where

| Script | Layer | Needs |
|---|---|---|
| `01-migrations.ts` | Migrations, schema objects, constraints, enums, replay safety | in-process PGlite |
| `02-search.ts` | Lexical/VI/typo search, truth filter, embeddings, semantic, hybrid, analytics writes | in-process PGlite |
| `03-coupon.ts` | Discovery → candidate → verification → state machine → publication → daily-free | in-process PGlite + stubbed `fetch` |
| `04-media-access-discovery.ts` | Media pipeline + SSRF, access classification, multi-domain discovery, coverage stats | in-process PGlite + stubbed `fetch` |
| `05-http.ts` | Public + admin surfaces over HTTP, flags at their deploy defaults | `pg-server` + `next start` |
| `06-flags-on.ts` | Same surfaces with feature flags enabled, cron runs, monetization | `pg-server` + `next start` |

`pg-harness.ts` builds the in-process database. `pg-server.ts` exposes the same
database over the Postgres wire protocol so the unmodified Next.js app can
connect with its normal `postgres-js` driver — that is what makes end-to-end HTTP
verification possible.

## Running

Database-level suites need nothing but a `DATABASE_URL` value to satisfy env
validation; the harness never connects to it.

```bash
DATABASE_URL=postgres://verify:verify@127.0.0.1:55432/verify npm run verify:db
```

HTTP suites need the database server and the app:

```bash
# terminal 1
DATABASE_URL=postgres://verify:verify@127.0.0.1:55432/verify npm run verify:pg-server

# terminal 2 — build and start against it
DATABASE_URL=postgres://verify:verify@127.0.0.1:55432/verify \
APP_URL=http://localhost:3100 \
AUTH_SECRET=verification-only-auth-secret-value-32chars-min \
CRON_SECRET=verification-only-cron-secret \
npm run build && npx next start -p 3100

# terminal 3
DATABASE_URL=postgres://verify:verify@127.0.0.1:55432/verify \
VERIFY_BASE_URL=http://localhost:3100 npm run verify:http
```

For `verify:flags-on`, start the app with the feature flags set to `true`
(`FEATURE_MONETIZATION`, `FEATURE_COURSE_AFFILIATE`, `FEATURE_COUPON_DISCOVERY`,
`FEATURE_MEDIA_RESOLVER`, `FEATURE_SIMILAR_COURSES`, `FEATURE_COURSE_COMPARE`,
`FEATURE_LEARNING_PATHS`, `FEATURE_TRACKER_UI`) plus `EMBEDDING_PROVIDER=fake`.

## Ground rules the harness follows

- **Nothing is fabricated.** No coupon status, verification timestamp, image
  result or affiliate credential is written by the harness. Every status
  asserted is produced by the code under test from the evidence it was given.
- **Only the network is stubbed.** `globalThis.fetch` is replaced so source HTML
  and image responses are deterministic, which keeps `safeHttpGet`,
  `validateSafeFetchUrl`, the redirect loop, the content-type allowlist and the
  size caps all executing for real.
- **The app is unmodified.** HTTP suites run `next start` on a normal production
  build.
- **Secrets are local placeholders.** `AUTH_SECRET` / `CRON_SECRET` exist only to
  satisfy production env validation on `next start`.

## Caveats

- PGlite is Postgres, but not identical to Neon. Driver behaviour differs: a JS
  `Date` bound into a raw `sql` template is accepted by PGlite and rejected by
  `postgres-js`. That difference is what the HTTP suites caught, and
  `src/test/driver-parameter-regression.test.ts` now guards it.
- Discovery needs an external search API, so `/api/cron/discover` is verified only
  to fail honestly without a key.
- Live coupon verification against Udemy and real embedding-provider calls are
  out of scope by design.
