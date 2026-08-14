# STOP 2 — Product Discovery Checklist (Provisional)

Status: **PROVISIONAL — flags OFF, thin catalog** (2026-08-14)

Context: Gate B carries an owner override (see `GATE_B_INTENT_DIAGNOSIS.md`).
All Wave 3 surfaces ship behind flags that default OFF, so this checklist is
scored against local flag-on runs, not production traffic. Re-score once the
catalog and production query volume are meaningful.

## 10-journey checklist

| # | Journey | Surface | Status | Notes |
|---|---------|---------|--------|-------|
| 1 | Search a topic keyword → relevant free courses | `/search` (lexical, always on) | PASS (provisional) | Lexical baseline from M20.1; hybrid behind `FEATURE_HYBRID_SEARCH` |
| 2 | Ask a natural-language question → parsed intent | `nl-intent.ts` behind `FEATURE_NL_COURSE_FINDER` | PASS (deterministic) | AI path is a stub; deterministic parse covers topic/level/duration/certificate/language |
| 3 | Vietnamese query (with/without diacritics) → same intent | `nl-intent.ts` | PASS (provisional) | Diacritic folding + VI keyword tokens; cross-language retrieval still behind `FEATURE_CROSS_LANGUAGE` |
| 4 | View a course → see similar free courses | course detail + `FEATURE_SIMILAR_COURSES` | PASS (provisional) | Diversity cap max 2/provider; free-list truth filter applied |
| 5 | Compare 2-3 courses on facts | `/compare?ids=` behind `FEATURE_COURSE_COMPARE` | PASS (provisional) | Facts only, no "best" judgment; ineligible price types dropped |
| 6 | Get a learning path from a goal | `/path?goal=` behind `FEATURE_LEARNING_PATHS` | PASS (provisional) | 3-7 deterministic steps; `courseIds` honestly empty — steps link to searches |
| 7 | Filter by certificate requirement | `/search` filters + intent parse | PASS | Existing catalog filters; intent parse sets `certificateRequired` |
| 8 | Zero-result query → honest empty state, no fabrication | `/search` empty state | PASS | Catalog-gap dominant (Gate B); no invented results |
| 9 | Discover courses by topic landing | `/free-courses/[topic]` | PASS | Pre-existing topic landings; path steps link into them |
| 10 | Trust free status on every surface | all Wave 3 surfaces | PASS | `isEligibleForFreeLists` enforced in similar, compare, and hybrid paths |

## Caveats

- "PASS (provisional)" means: implemented, unit-tested, verified with flags on
  locally; not validated against real users or a populated catalog.
- Journeys 2-6 are invisible in production until their flags are enabled
  (see `M20_11_STAGED_ROLLOUT.md`).
- Re-run this checklist at rollout stage 2 with production analytics.
