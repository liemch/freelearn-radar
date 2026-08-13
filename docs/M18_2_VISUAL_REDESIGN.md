# M18.2 — Public UI Visual Redesign

Status: **COMPLETE** (pending final quality gate verification)

## Problems identified (pre-redesign)

- Homepage hero too tall; repeated product name as headline
- Pale brand-green dominated surfaces; excessive empty space
- Search and trending topics felt like admin form controls
- Course content buried below informational panels
- Empty catalog exposed migration/seed instructions and “Open admin”
- Course cards read as database records, not discovery content
- No bilingual public routing; weak consumer-product feel

## Visual direction

Neutral light foundation with intentional teal accents. Compact hero with value proposition. Course imagery and cards as primary visual content. Editorial section headings without giant bordered containers. Modern learning-discovery product — not SaaS dashboard or AI template.

## Homepage changes

- `HomeHero`: reduced height, value headline, prominent search, inline trending links
- Discovery sections: free this week, best free, recently verified, topics, certificates, short courses, providers, monthly collection — render only when data exists
- Polished empty catalog state (`EmptyState`) — no technical setup copy
- Removed admin/migration messaging from public surface

## Navigation changes

- `SiteHeader` / `SiteHeaderClient`: compact sticky nav, locale-aware links, language switcher
- `SiteFooter`: localized tagline and discovery links via `localePath`

## i18n architecture

- Routes: `/en/...`, `/vi/...` under `src/app/[locale]/`
- Middleware negotiates locale (cookie + Accept-Language) and redirects bare paths
- Dictionaries: `src/lib/i18n/dictionaries/{en,vi}.ts`
- Helpers: `localePath`, `switchLocalePath`, `resolveLocaleParam`
- Localized metadata + hreflang on homepage; canonical paths on all public pages
- Sitemap emits both locale URLs

## CourseCard changes

- Visual area with image or provider/category fallback (`CourseCardVisual`)
- Scan order: visual → free status → title → provider → description → meta → CTA
- Locale-aware labels for free status, certificate, level, verification

## Course Detail changes

- Locale wiring for header/footer/metadata
- Outbound CTA uses root `/course/[slug]/go` (no locale prefix; middleware skips `/go`)
- Localized free status badge and certificate labels

## Search / Category / Provider / Collection changes

- All public catalog pages moved under `[locale]` with locale props on shared components
- Empty states use user-facing copy with localized action links
- Filter URL state preserved from M17/M18

## Empty / error / loading changes

- `EmptyState` redesigned — no dashed admin boxes
- Public homepage never shows migration instructions
- Development diagnostics remain admin-only

## Image pipeline

- Schema fields: `image_source_url`, `image_storage_url`, `image_last_verified_at`, `image_policy`
- Migration: `drizzle/0003_course_images.sql`
- Service: `src/services/images/course-image-service.ts` — SSRF-safe fetch, size/type validation, mockable `MemoryCourseImageStorage`
- Display: `getCourseVisual()` priority chain; never broken images

## Components added / refactored

| Component / module | Change |
|--------------------|--------|
| `home-hero.tsx` | Compact hero + search |
| `course-card.tsx` | Visual hierarchy redesign |
| `course-card-visual.tsx` | Image + fallback |
| `site-header-client.tsx` | Mobile nav + language switcher |
| `language-switcher.tsx` | New |
| `locale-html-lang.tsx` | New |
| `empty-state.tsx` | User-facing empty UX |
| `globals.css` | Neutral surface tokens |
| `labels.ts` | vi/en free status + certificate |
| `course-image-service.ts` | New |

## Tests added

- `src/test/m18-2-i18n.test.ts` — path helpers, locale list, vi labels
- `src/test/m18-2-images.test.ts` — SSRF, content-type, size limits, ingestion fallback, visual priority

## Accessibility impact

- Maintained semantic headings, focus rings, nav `aria-current`
- Language switcher keyboard accessible
- Free status always includes text label

## Performance impact

- Server Components retained for catalog pages
- Lazy-loaded course images below fold
- No new heavy client libraries

## Regressions found / fixed

- Course outbound link incorrectly used `/en/course/.../go` — fixed to root `/course/.../go`
- Duplicate non-locale public pages removed (middleware-only `[locale]` routes remain)

## Remaining visual debt

- Catalog filter labels still English-only (functional; dictionary extension optional)
- Course detail page copy partially English (metadata labels)
- Course detail lacks hero image band (card visual pattern not yet applied to detail)
- Provider logos not yet in data model — fallback tones only
- Image ingestion not wired into discovery pipeline (schema + service ready)
- `verificationAgeLabel` not yet localized for vi

## Quality gates

| Gate | Result |
|------|--------|
| lint | PASS |
| typecheck | PASS |
| test | PASS (174/174) |
| build | PASS |

(Fonts load at runtime via Google Fonts `<link>` to avoid build-time fetch failures in restricted networks.)
