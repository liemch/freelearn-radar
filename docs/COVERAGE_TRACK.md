# Coverage Track v1

Status: **IMPLEMENTED — M20.2 still deferred**

Date: 2026-08-14

Gate B (`docs/GATE_B_INTENT_DIAGNOSIS.md`) concluded **CATALOG_GAP ≥ 50%**.
This track funds catalog growth, not semantic search.

## Goals

1. More candidates per day (aligned discovery → fetch → AI caps)
2. Broader provider/query matrix (§68 Group-A start)
3. Faster human publish path (bulk approve UI)

## Shipped

| Change | Detail |
|--------|--------|
| Env defaults | `DISCOVERY_QUERY_LIMIT=50`, `DISCOVERY_RESULT_LIMIT=10`, `MAX_SOURCE_FETCHES_PER_RUN=60`, `AI_ANALYSIS_LIMIT=60` |
| Cron | Second discover run at `0 12 * * *` (keep `0 6` + verify at `0 18`) |
| Seed | LinkedIn + thin categories + HubSpot / SkillsBuild / Trailhead / Kaggle |
| Admin discovery | Default 25 queries, result limit control, fetch+analyze after search |
| Candidates | Bulk approve/reject UI → existing `/api/admin/candidates/bulk` |

## Ops after deploy

1. Set the same env values on Vercel if overrides still pin old 25/5/30/20.
2. Let `vercel-build` / `db:seed` insert new providers and queries.
3. Run Admin → Discovery (ignore schedule) or wait for cron.
4. Approve ready candidates in bulk at `/admin/candidates?view=ready`.

## v2 — reviewer yield (2026-08-14)

First bulk review of the v1 output ended with every ready candidate rejected as
"not a free course". Three causes, all addressed here.

| Problem | Change |
|---------|--------|
| Price was resolved from page text and AI only, so a page that never mentions price fell to `UNKNOWN` even on a provider whose whole catalog is free | `provider_policies.catalog_wide_free` (migration `0009`) + `findCatalogFreePricePolicy`, consumed by `resolvePriceType` between page evidence and AI (§66.3) |
| A refused approval reported only a failure count, so the reviewer could not tell refusal from rejection | Bulk list now lists each failed candidate with the message the server returned |
| Trial-only and paid-catalog queries cost one manual page visit each and can never be published | `RETIRED_DISCOVERY_QUERIES` (LinkedIn Learning, 3 Udemy) disabled on seed; ~30 new queries on free-by-policy providers |

Providers marked `catalogWideFree`: Microsoft Learn, freeCodeCamp, Kaggle Learn,
HubSpot Academy, IBM SkillsBuild, Salesforce Trailhead, Google Developers.
Deliberately **not** marked: Udemy, Coursera, edX, AWS, LinkedIn Learning — a
mixed catalog would let the flag assert a free price for paid pages.

Guard rails kept intact: explicit page evidence still wins, a deterministic
refusal (ambiguous copy, free preview, conflicting signals) is never upgraded by
policy, `FREE_WITH_COUPON` stays MANUAL-only, and a provider with two competing
catalog-wide rules resolves to `UNKNOWN` instead of a guess.

Retired queries stay in `discovery_queries` with `enabled = false`; the seed
re-asserts that on every deploy, so re-enabling one means removing it from
`RETIRED_DISCOVERY_QUERIES`.

Note: rejection is terminal and discovery treats the URL as a duplicate
afterwards, so a wrongly rejected candidate does not come back on its own.

## When to reopen Gate B / M20.2

Re-run Intent Diagnosis when:

- Published free catalog is no longer trivially thin, and
- `npm run search:intent-sample` yields a meaningful sample, and
- **CATALOG_GAP share of non-JUNK < 50%**

Until then: **do not start M20.2**.
