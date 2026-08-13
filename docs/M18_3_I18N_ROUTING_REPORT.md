# M18.3 — I18N Routing Persistence + Public UI Polish

Status: **COMPLETE**

## Root cause

Two compounding issues caused locale to “fall back” to English after a
language switch:

1. **Unprefixed public links** — `CatalogFiltersForm` category chips used
   bare paths (`/category/[slug]`). Middleware then negotiated locale from
   the preference cookie / Accept-Language. After a client soft-navigation
   language switch, the `flr_locale` cookie was not always updated reliably,
   so bare paths redirected to **`/en/...`**.

2. **Stale locale-prefixed props** — Client navigation components could keep
   `/en/...` href props across a soft locale change. Without a live
   re-bind to the URL locale, Explore / Categories / Search / Course links
   could navigate under EN even while the visible page was Vietnamese.

## Architecture before

- Manual `localePath(locale, …)` on most (but not all) server pages
- Plain `next/link` everywhere
- Language switcher changed pathname only (no explicit cookie, no query)
- Filters category chips: **unprefixed**
- Middleware: URL locale authoritative when present; bare paths → cookie

## Architecture after

Centralized contract:

| Piece | Role |
|-------|------|
| `localizeHref(href, locale)` | Strip any `/en`/`/vi`, re-prefix for live locale; skip admin/api/go/external |
| `LocalizedLink` | Client `Link` that always uses URL locale via `useCurrentLocale()` |
| `useLocalizedPath` | Forms (search, filters) bind `action` to live locale |
| `switchLocalePath` | Preserves path + **query** + hash |
| Language switcher | Sets `flr_locale` cookie on click + keeps query params |
| `buildLocaleAlternates` | Canonical + hreflang (`en`, `vi`, `x-default`) |

Server Components may still pass `localePath(...)` or bare `/search` —
`LocalizedLink` / `useLocalizedPath` normalize either form.

## Navigation helper strategy

Prefer:

```tsx
<LocalizedLink href="/course/slug" />
// or
<LocalizedLink href={localePath(locale, "/course/slug")} />
```

Do **not** hand-concatenate `/vi` in call sites when a shared helper exists.

Outbound provider navigation stays at `/course/[slug]/go` (no locale).

## Locale precedence

1. **Explicit locale in URL** (`/vi/...`, `/en/...`) — authoritative; never
   overridden by cookie
2. **Explicit user preference** (`flr_locale` cookie) — used only for bare
   paths (`/search` → `/vi/search`)
3. **Accept-Language** → then **default (`en`)**

Language switcher writes the cookie immediately on click so bare-path
fallbacks match the user’s choice even if middleware Set-Cookie on RSC
soft-nav is delayed.

## Language switch behavior

`/en/category/ai?sort=newest` → VI → `/vi/category/ai?sort=newest`

Same for course, search, provider, collections.

## SEO impact

- Homepage, search, course detail use `buildLocaleAlternates`
- Sitemap already emits both locales (M18.2)
- JSON-LD breadcrumb / course URLs on detail pages use locale-aware absolute URLs
- Filtered search remains `noindex` when filters present (M17 preserved)

## Translation completeness

Expanded dictionaries for:

- Search page chrome
- Filter labels / sort / levels
- Pagination
- Empty search action
- 404 / error copy

Course titles and provider names remain untranslated (authoritative source).

## Tests added

`src/test/m18-3-i18n-routing.test.ts`

Covers EN/VI homepage Explore, VI category/search/filter/course/provider/
related/pagination, language switch with query survival, stale `/en` href
repair, unprefixed category chips, skip list for admin/api/go, hreflang.

## Remaining i18n risks

- Some collection / category / provider / course-detail body copy still
  partially English (section headings like “Key facts”)
- Root `not-found` / `error` default to EN dictionary (no locale param on
  those boundaries); `LocalizedLink` still follows live URL locale when
  present
- Duration bucket labels in filters remain English constants from domain
- Image ingestion still not wired into discovery (M18.2 debt)

## Public UI polish (low-risk only)

- No full redesign; preserved M18.2 direction
- Empty catalog still user-facing (no fake courses)
- Locale-safe search form + filter chrome

## Quality gates

| Gate | Result |
|------|--------|
| lint | PASS (1 existing font warning) |
| typecheck | PASS |
| test | PASS (196/196) |
| build | PASS |
