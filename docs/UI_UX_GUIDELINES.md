# UI/UX Guidelines — FreeLearn Radar

For agents and contributors after M18. Prefer **refinement** over redesign.

## Product intent

FreeLearn Radar is a curated free-course discovery product. Course content is the hero. Users should quickly understand: what is free, who provides it, and whether the listing is fresh.

## Do

- Reuse `PageShell`, `CourseCard`, `FreeStatusBadge`, `EmptyState`, shadcn `Button`/`Input`
- Keep one primary CTA per page
- Use human labels from `labels.ts` for public (and admin display) copy
- Preserve M17 SEO metadata, shareable filter URLs, outbound `/go` redirects
- Prefer Server Components; client only for interactivity (header menu, share, forms, admin actions)
- Keep long descriptions readable (`max-w-prose`, calm leading)

## Don’t

- Expose enums (`FREE_FULL`, `READY_FOR_REVIEW`) in public copy
- Prioritize AI scores / trust decimals on public surfaces
- Nest cards inside cards or add decorative purple/glow chrome
- Add a second UI framework or dark mode unless fully consistent
- Change SearchProvider / AIProvider / DB schema for visual work
- Commit, push, or deploy as part of UI milestones unless asked

## Page checklist

### Homepage

Compact hero (brand + one line + search + light topic chips) → useful course sections. Skip empty rails.

### Course detail

Above the fold: title, provider, free status, certificate, verification, primary **View course**. Key facts as a flat `dl`, not a wall of boxed metrics.

### Search / category / provider / collections

Same shell, filters with Clear all, result count, empty state with next action. Filtered URLs may be `noindex` (M17).

### Admin

Productivity over polish. Candidate review: evidence → classification rationale → actions; JSON collapsed.

## Accessibility

- Semantic landmarks and heading order
- Visible focus (`:focus-visible` ring)
- Labels on controls; touch targets ≥ ~40px where practical
- Free status: text + tone + optional title hint (not color alone)
- Prefer native HTML; add ARIA only when needed

## Responsive

Spot-check 375 / 768 / 1024 / 1440. Fix overflow, tiny CTAs, and sticky conflicts. Mobile header uses a simple Menu disclosure.

## Microcopy

Short, natural, non-technical on public pages. Admin may keep precise status codes as secondary monospace hints.
