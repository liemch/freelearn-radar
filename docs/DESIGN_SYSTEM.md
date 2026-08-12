# Design System — FreeLearn Radar

Status: M18  
Stack: Tailwind CSS + shadcn/ui (Button, Input, Label, Card). Do not add another UI framework.

## Brand

- Name: **FreeLearn Radar**
- Mark: teal radar arcs (`BrandMark` + `app/icon.tsx`)
- Feel: modern, calm, educational, trustworthy — curated discovery, not coupon spam or AI-demo chrome
- Avoid: purple glow, glass cards, oversized shadows, decorative gradients without purpose

## Color

CSS variables in `src/app/globals.css` (teal learning palette).

| Token | Use |
|-------|-----|
| `background` / `foreground` | Page canvas / body text |
| `card` | Elevated surfaces |
| `primary` | Brand actions, links emphasis |
| `secondary` / `muted` | Soft surfaces, metadata |
| `destructive` | Dangerous admin actions |
| `border` / `ring` | Dividers, focus |

Free-status tones live in `FreeStatusBadge` (emerald / sky / amber / orange / muted). Never rely on color alone — always include a text label.

## Typography

Fonts: **Fraunces** (display) + **Manrope** (body).

| Role | Guidance |
|------|----------|
| Display / H1 | `font-display`, ~3xl–5xl, semibold, `text-balance` |
| H2 | ~xl–2xl, semibold, tracking-tight |
| H3 / card title | ~lg, semibold |
| Body | base / sm, relaxed leading, `max-w-prose` for long copy |
| Small / metadata | xs–sm, `text-muted-foreground` |
| Caption | xs uppercase tracking for provider line on cards |

Do not use tiny metadata as the only free-status signal. Course titles stay visually dominant.

## Spacing & layout

- Container: `PageShell` → `max-w-6xl` + `px-4 sm:px-6`
- Page rhythm: `PageStack` → `gap-10/12`, `py-10/12`
- Section gaps: prefer `space-y-8` on catalog pages
- Grid: course grids `gap-4 sm:grid-cols-2 lg:grid-cols-3`

## Radius & elevation

| Surface | Radius | Shadow |
|---------|--------|--------|
| Cards / panels | `rounded-xl` | `shadow-sm` (hover `shadow-md` optional) |
| Controls (button/input) | `rounded-md` | `shadow-xs` via shadcn |
| Pills / badges | `rounded-full` | none |

Avoid mixing `rounded-2xl` / `rounded-3xl` on public surfaces.

## Components

### Buttons

Use `@/components/ui/button`.

- Primary CTA: `default` (one per view)
- Secondary: `secondary` / `outline`
- Tertiary: `ghost`
- Danger (admin reject): `destructive`

### Inputs / selects

Visible `<label>` text required. Never placeholder-only. Select field class shared in catalog filters.

### Badges

- Free status → `FreeStatusBadge` only
- Certificate → quiet border pill
- Do not show AI/trust numeric scores on public cards

### Cards

`CourseCard` is the product card. Hierarchy:

1. Free status  
2. Title  
3. Provider  
4. Short description  
5. Level · Duration  
6. Verification age  
7. Secondary CTA (“Open course”)

### Empty / error / loading

- Empty: `EmptyState` (title + explanation + one action)
- Public errors: friendly + recoverable (`error.tsx`, `not-found.tsx`)
- Prefer skeletons / pending buttons over full-page spinners for small ops

### Navigation

Header: Logo + Explore + Categories + Search. Sticky with light blur. Active `aria-current`. Admin stays off the public primary nav.

## Free status labels

Source: `src/domain/course/labels.ts`

| Enum | Public label |
|------|--------------|
| FREE_FULL | 100% Free |
| FREE_AUDIT | Free to Audit |
| FREE_WITH_COUPON | Coupon Required |
| TEMPORARILY_FREE | Limited-Time Free |
| FREE_TRIAL | Free Trial |
| PAID | Paid |
| UNKNOWN | Status Unknown |

Never expose raw enums in public UI.

## Trust / verification

Public: “Verified recently”, relative age, stale amber notice.  
Admin: confidence bands, evidence, JSON behind `<details>`.

## Admin patterns

Dense, predictable, non-marketing. Tables keep human labels; store enums in values. Dangerous actions use `destructive`.
