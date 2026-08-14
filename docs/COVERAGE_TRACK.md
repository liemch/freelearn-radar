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

## When to reopen Gate B / M20.2

Re-run Intent Diagnosis when:

- Published free catalog is no longer trivially thin, and
- `npm run search:intent-sample` yields a meaningful sample, and
- **CATALOG_GAP share of non-JUNK < 50%**

Until then: **do not start M20.2**.
