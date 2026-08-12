# M18 UI/UX Report

Date: 2026-08-13  
Scope: Professional UI/UX polish & design system (refine M17; no business-logic rewrite)

## UI audit summary

See `docs/M18_UI_UX_AUDIT.md`. P0–P2 items were implemented: free-status tone/labels, enum scrubbing, homepage consolidation, radius consistency, CourseCard hierarchy, course detail key facts, shared shells, admin label polish, brand mark/favicon, empty/error pages.

## Before / after

| Area | Before (M17) | After (M18) |
|------|--------------|-------------|
| Free status | Often emerald-only / emoji-ish | Shared `FreeStatusBadge` + human labels + tones |
| Enums in UI | Leaked on cert page / admin tables | Labels via `labels.ts` |
| CourseCard | Score competed visually | Free → title → provider → meta → verify |
| Course detail | Dense bordered fact boxes | Flat key facts + clear View course CTA |
| Layout | Per-route container drift | `PageShell` / `PageStack` |
| Header | Overloaded + Admin in primary | Explore / Categories / Search + brand mark |
| Empty/error | Uneven | `EmptyState`, `not-found`, `error` |
| Admin review | JSON always open | Classification first; JSON in `<details>` |

## Pages improved

Public: `/`, `/search`, `/course/[slug]`, `/category/[slug]`, `/provider/[slug]`, `/free-certificate-courses`, `not-found`, `error`  
Admin: courses table, candidates list/detail, course form selects, candidate reject styling  
Chrome: header, footer, favicon (`app/icon.tsx`)

## Components created / refactored

- Created: `FreeStatusBadge`, `PageShell`/`PageStack`/`SectionHeading`, `BrandMark`, `app/icon.tsx`, `not-found.tsx`, `error.tsx`
- Refactored: `CourseCard`, `catalog-filters`, `empty-state`, `pagination`, site header/footer, course detail, homepage, labels helpers

## Design system changes

Documented in `docs/DESIGN_SYSTEM.md` and `docs/UI_UX_GUIDELINES.md`: typography, spacing, radius, CTA hierarchy, free/trust language, admin density rules. Light mode only (no new dark mode).

## CourseCard improvements

Free status first; demoted editorial/AI score; certificate only when known; verification age + stale warning; secondary full-width “Open course”; `rounded-xl` surface.

## Course Detail improvements

Provider + title + short description; verification notice; free/cert badges; borderless key facts; sticky aside with primary external CTA; share; related courses preserved.

## Search / filter improvements

PageShell consistency; result count copy; human filter option labels; Clear all; active-filter cue; shareable URL state unchanged from M17.

## Admin UX improvements

Human price/status/discovery labels; form selects show readable labels (enum values retained); Reject = destructive; candidate empty state; review screen explains classification; AI JSON collapsed.

## Responsive improvements

Unified padding/container; header collapses at `md`; filter grid stacks on small screens; touch-friendlier filter chips/buttons.

## Accessibility improvements

Focus rings retained; header `aria-current` / `aria-expanded`; empty `role="status"`; free status text+dot+title; semantic facts `dl`; friendlier 404/error recovery.

## Performance implications

Most pages remain Server Components. Header is a small client island. Favicon via `ImageResponse`. No intentional bundle bloat; no speculative micro-opts.

## Tests added / updated

- `labels.test.ts` updated for `shortHint` / certificate wording
- No SearchProvider/AIProvider/DB behavior changes expected

## Regressions discovered / fixed

- Label API removed emoji `badge` — callers migrated to `FreeStatusBadge` / `shortHint`
- Public FREE_CERTIFICATE enum copy scrubbed from free-certificate collection metadata/body

## Remaining UI/UX debt

- True mobile filter sheet (Radix Sheet) not added — stacked filter panel instead
- Admin shell still per-page headers (not a shared admin nav layout)
- Collection / topic / monthly-best pages share patterns but were lightly touched vs homepage/search/detail
- Visual QA against live Neon data still needed (empty rails, long titles, stale offers)
- Dark mode intentionally not introduced

## Quality gates

Tests before (M17 baseline): **126**  
Tests after: **126**

| Gate | Result |
|------|--------|
| lint | PASS |
| typecheck | PASS |
| test | PASS (126) |
| build | PASS |

## Final status

**UI_UX_READY_FOR_LIVE_VALIDATION**

No commit / push / deploy performed (per M18 rules). M19 not started.
