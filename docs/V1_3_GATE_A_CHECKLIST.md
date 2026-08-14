# v1.3 Gate A — Local Readiness and Production Checklist

Date: 2026-08-14

Status: **PASS**

Production origin verified: https://freelearn-radar.vercel.app/

Owner sign-off (2026-08-14): `FEATURE_AUTO_STATUS` / `FEATURE_PRICE_ALERTS`
treated as unset/`false`; provisional §80.2 accepted (`unknown` metrics + thin
catalog → coverage risk; M20.0 baseline still allowed).

This document updates the implementation evidence after
`V1_2_PRODUCTION_AUDIT.md`. It does not rewrite that historical audit.

## Local remediation evidence

- `FREE_TRIAL` / `PAID` excluded from free catalog SQL even with explicit
  `?price=` (parse also drops those values).
- Best and topic free-list queries use the same exclusion.
- Provider policies loaded from DB for verify/approve; Coursera/edX audit rules
  present; `FREE_AUDIT + UNKNOWN` blocked on approve / published PATCH /
  verification persist.
- Worker/cron/AI audit coverage expanded (see prior remediation).
- Public navigation feedback: top loader + route skeletons.

## Production smoke (2026-08-14, agent)

Origin: https://freelearn-radar.vercel.app/

| Check | Result |
|-------|--------|
| `GET /api/health` | 200 `{"status":"ok"}` |
| `GET /api/health?deep=1` | 200 `database:"ok"` |
| `GET /vi`, `/en` | 200 |
| `GET /vi/search?q=python` | 200 |
| `GET /vi/free-courses/ai` | 200 |
| `GET /vi/free-certificate-courses` | 200 |
| `GET /vi/best/2026/8` | 200 |
| `GET /vi/course/{slug}` | 200 (prompt-engineering…free-course) |
| `GET /course/{slug}/go` | 302 → udemy.com |
| `GET /admin/login` | 200 |
| `GET /vi/tracker` | 404 (consistent with `FEATURE_TRACKER_UI` ≠ true) |
| `GET /vi/topic/python` | 404 (topic flag/threshold — expected early catalog) |

Observed catalog size from homepage copy: **1 verified free course**. That is
important for §80.2 / Gate B (coverage vs retrieval).

`?price=FREE_TRIAL` does not expose a FREE_TRIAL select option; filter is not
accepted by the public parser.

## Production checks — owner sign-off

- [x] Vercel: `FEATURE_AUTO_STATUS` unset or `"false"` — owner YES 2026-08-14
- [x] Vercel: `FEATURE_PRICE_ALERTS` unset or `"false"` — owner YES 2026-08-14
- [ ] Neon: migration `0005` tables present (7 M19 tables) — deep health proves
      DB reachable but not schema inventory (carry into ops follow-up)
- [ ] Vercel cron logs: discover / monitor / verify firing without repeated failures
- [ ] Sample `admin_audit_log` rows from a worker/cron run look bounded and typed
- [x] Accepted-risk list for remaining dormant P1 / npm audit — see below
- [x] §80.2 Precondition Check: explicit `unknown` + written conclusion — owner YES

## §80.2 accepted (early production)

```text
[?] outbound CTR tổng                     = unknown (need analytics window)
[?] traffic/tháng (sessions)              = unknown
[?] returning visitor %                   = unknown
[?] alert → outbound CTR                  = N/A (alerts flag off / unused)
[?] search → detail CTR                   = unknown (no search_queries yet → M20.0)
[?] % session có dùng search              = unknown
[?] zero-result rate hiện tại             = unknown
Catalog size (homepage)                   ≈ 1 published free course
```

**Product reading (owner-accepted):** with ~1 course and no search
instrumentation yet, the dominant risk is **COVERAGE / catalog thinness**, not
ranking. M20.0 proceeds for baseline instrumentation. Gate B may conclude
`CATALOG_GAP ≥ 50%` and defer M20.2+.

## Accepted risks

- `npm audit --omit=dev`: 4 high advisories requiring breaking upgrades —
  ACCEPTED_RISK for Gate A; schedule separate upgrade PR.
- Dormant P1 items not re-opened by smoke remain tracked outside this gate.
- Schema inventory / cron log sampling remain ops follow-ups; not blocking M20.0.

## Local quality gates (pre-M20.0)

- `npm run lint`: PASS (2 pre-existing warnings)
- `npm run typecheck`: PASS
- `npm run test`: PASS (382+ after soft-nav tests)
- `npm run build`: PASS

## Gate decision

**PASS** — safety flags signed off; §80.2 unknown + thin-catalog conclusion
accepted. M20.0 may start. Do not open M20.1 until Gate B Intent Diagnosis has a
written CATALOG_GAP conclusion (`docs/GATE_B_INTENT_DIAGNOSIS.md`).
