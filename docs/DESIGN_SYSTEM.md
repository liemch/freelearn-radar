# Design System — FreeLearn Radar

Status: M18.2  
Stack: Tailwind CSS + shadcn/ui (Button, Input, Label). Do not add another UI framework.

## Brand

- Name: **FreeLearn Radar**
- Mark: teal radar arcs (`BrandMark` + `app/icon.tsx`)
- Feel: modern, energetic, educational, trustworthy — curated learning discovery, not SaaS dashboard or coupon spam
- Avoid: purple AI gradients, glassmorphism, giant marketing heroes, decorative blobs, card-in-card nesting

## Color (M18.2)

Primary canvas is **neutral light** (`background`, `--surface`, `--surface-muted` in `globals.css`). Teal brand (`primary`) is used **intentionally** for:

- Primary CTA
- Active navigation
- Free-status emphasis (via badge tones)
- Selected / focus accents

Do **not** wash entire pages in pale brand green.

| Token | Use |
|-------|-----|
| `background` | Page canvas (neutral) |
| `--surface` | Footer, subtle section shifts |
| `--surface-muted` | Image fallbacks, soft bands |
| `card` | Course cards, filter panels |
| `primary` | Brand actions, link hover |
| `secondary` / `muted` | Metadata, inactive chrome |
| `border` / `ring` | Sparingly — prefer spacing over boxes |

Free-status tones live in `FreeStatusBadge` (emerald / sky / amber / orange / muted). Always pair color with a text label.

## Typography

Fonts: **Fraunces** (display, selective) + **Manrope** (body).

| Role | Guidance |
|------|----------|
| Display / hero | `font-display`, ~2xl–3xl max on homepage, semibold |
| H1 (catalog) | ~2xl–3xl, semibold |
| H2 section | ~xl, semibold |
| Course title (card) | `text-base` semibold, line-clamp safe |
| Body | sm–base, relaxed leading |
| Metadata | xs–sm, `text-muted-foreground`, never sole signal for free status |

Editorial serif is for section headings and hero — not every label.

## Spacing & layout

- Container: `PageShell` → `max-w-6xl` + `px-4 sm:px-6`
- Homepage hero: compact — courses visible above the fold when data exists
- Section separation: spacing + background shift, not nested bordered boxes
- Course grid: `gap-4 sm:grid-cols-2 lg:grid-cols-3`

## Radius & elevation

| Surface | Radius | Shadow |
|---------|--------|--------|
| Course cards | `rounded-xl` | hover `shadow-md`, ring-1 |
| Controls | `rounded-md` | minimal |
| Badges | `rounded-full` | none |

Avoid excessive rounded corners and stacked shadows.

## Internationalization

Public routes: `/en/...` and `/vi/...`. UI strings from `src/lib/i18n/dictionaries/`. Course **titles stay authoritative** (source language). Labels for free status, certificates, filters, empty states are localized via `labels.ts` + dictionaries.

Language switcher in header preserves path (`switchLocalePath`).

## Components

### Navigation (`SiteHeader`)

Logo + Explore + Categories + Providers + Search + language switcher. Compact sticky header. Admin never appears on public nav.

### Homepage (`HomeHero`)

Value headline (not product name repeat), prominent search, lightweight trending links, discovery sections below — courses before decorative chrome.

### CourseCard

Visual hierarchy:

1. Visual (`CourseCardVisual` — image or provider/category fallback)
2. Free status (`FreeStatusBadge` + locale)
3. Title
4. Provider link
5. Short description (2 lines)
6. Level · duration
7. Verification age
8. CTA

No AI scores. No badge overload.

### Course images

Priority: stored URL → source URL → provider-tone fallback → category tone. Never broken `<img>`. Remote fetch/storage via `course-image-service.ts` with SSRF guards.

### Empty / error / loading

- `EmptyState`: user-facing copy only — never migration/admin instructions
- Skeletons shaped like cards where applicable
- Public errors: friendly, recoverable

### Filters

Lightweight toolbar form; active filters visible; clear-all when needed. Shareable URL state preserved (M17).

## Free status labels

Source: `src/domain/course/labels.ts` (en + vi)

| Enum | EN | VI |
|------|----|----|
| FREE_FULL | 100% Free | Miễn phí 100% |
| FREE_AUDIT | Free to Audit | Học thử miễn phí |
| FREE_WITH_COUPON | Coupon Required | Cần mã coupon |
| TEMPORARILY_FREE | Limited-Time Free | Miễn phí có thời hạn |
| FREE_TRIAL | Free Trial | Dùng thử miễn phí |
| PAID | Paid | Trả phí |
| UNKNOWN | Status Unknown | Chưa rõ trạng thái |

## Trust / verification

Public: relative age (“Checked 2 days ago”), stale amber notice. No numeric trust/AI scores.

## Responsive

Design for 375 / 768 / 1024 / 1440. Mobile: search + trending + courses prioritized. Touch targets ≥ 44px where practical.

## Accessibility

Semantic landmarks, visible focus rings, `aria-current` on nav, alt text on meaningful images (decorative card fallbacks use `alt=""`).

## Admin patterns

Unchanged from M18 — dense, non-marketing. Public/admin separation is strict.
