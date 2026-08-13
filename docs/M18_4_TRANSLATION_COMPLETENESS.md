# M18.4 — Translation Completeness (Public + Admin)

## Reported symptom

> "Chọn EN rồi chuyển sang VI thì đổi sang tiếng Việt, nhưng khi chuyển sang trang Categories khác lại về EN."

## Root cause

M18.3 fixed **URL locale persistence**, and that part was working: navigating from `/vi`
to Categories correctly lands on `/vi/free-courses/ai`.

The regression the user saw was **not routing** — it was **content**. The destination
pages rendered hardcoded English because the locale never reached the copy:

- `topic-landings.ts` stored a single English `title` / `heading` / `description`.
- `DURATION_BUCKETS` stored a single English `label`.
- Category, provider, collection, certificate, best-of-month and course-detail pages
  contained literal English JSX text ("Home", "Related topics", "Key facts",
  "Recently verified on this page", "N courses", empty-state copy, CTA copy).
- `verificationAgeLabel()` returned English unconditionally.
- The root 404 and error pages were pinned to `defaultLocale`.
- Admin had **no i18n at all**.

So the URL said `/vi` while the page read as English — indistinguishable from a
routing failure to the user.

## Changes

### Bilingual content data

| Source | Before | After |
| --- | --- | --- |
| `topic-landings.ts` | one English copy block | `en` / `vi` blocks + `topicCopy(landing, locale)` |
| `catalog-query.ts` | `label` | `label` + `labelVi` + `durationBucketLabel(bucket, locale)` |
| `freshness-policy.ts` | English literals | optional `labels` argument, English default preserved |

### Public dictionary

Added `common`, `pages`, `courseDetail`, `verification`, `share`, `meta` and `a11y`
sections to `Dictionary`, with matching `en` / `vi` entries. Count-sensitive strings are
functions (`courseCount(n)`, `providerListed(n)`) so English pluralization and Vietnamese
non-pluralization both stay correct.

### Pages wired to the dictionary

`category/[slug]`, `provider/[slug]`, `collections/[slug]`, `free-courses/[topic]`,
`free-certificate-courses`, `best/[year]/[month]`, `course/[slug]`, plus `not-found.tsx`
and `error.tsx`.

### Components

`course-card`, `course-section`, `verification-freshness`, `share-course-button` now take
locale or label props instead of embedding English.

### Admin i18n (new)

Admin routes are intentionally **not** locale-prefixed, so locale comes from the
`flr_locale` cookie that middleware already maintains:

- `src/lib/i18n/server-locale.ts` — `getPreferredLocale()` (shared by admin and root 404)
- `src/lib/i18n/admin-locale.ts` — `getAdminLocale()`
- `src/lib/i18n/admin/{types,en,vi,index}.ts` — separate admin dictionary
- `src/components/admin/admin-language-switcher.tsx` — writes the cookie, then
  `router.refresh()` so server components re-render
- All 9 admin pages and 5 admin components wired; login page split into a server shell
  plus `login-form.tsx` client component so it can receive localized labels

### Locale precedence (unchanged)

```
explicit locale in URL  →  flr_locale cookie  →  Accept-Language  →  default (en)
```

Admin and the root 404 skip step 1 because they have no locale segment.

## `<html lang>`

The root layout owns `<html>` and is shared by both locales, so a prerendered per-locale
`lang` attribute is not possible without dropping SSG on every public route.
`LocaleHtmlLang` was changed from a `useEffect` (applied after hydration) to a synchronous
inline script, so `lang` is correct before first paint instead of after.

**Known limitation:** raw HTML fetched by a crawler still shows `lang="en"`. The
`hreflang` alternates emitted by `buildLocaleAlternates` remain the authoritative
language signal for search engines. Fixing the attribute itself requires moving `<html>`
into per-locale root layouts via route groups — deliberately deferred as too invasive
for a bug fix.

## Tests

`src/test/m18-4-translation-completeness.test.ts` (17 tests):

- EN/VI key sets are identical in both directions, for both the public and admin dictionaries
- Leaf types match (string vs. function) across locales
- No empty strings
- VI values are not byte-identical copies of EN, with an explicit allow-list for legitimate
  proper nouns (this check caught `nav.menu`, which was still "Menu" in both)
- Every topic landing has non-empty, genuinely different EN and VI copy
- Duration buckets resolve a distinct localized label
- `verificationAgeLabel` returns English by default and Vietnamese with the VI dictionary
- Count helpers pluralize per locale

## Verification

Checked against the real production server, not just helper output:

| Check | Result |
| --- | --- |
| `/vi/search` rendered copy | Vietnamese |
| `/vi/search` lang script | `documentElement.lang="vi"` |
| `/en/search` lang script | `documentElement.lang="en"` |
| `/admin/login` with `flr_locale=vi` | "Đăng nhập quản trị", "Mật khẩu" |
| `/admin/login` with `flr_locale=en` | "Admin Sign In", "Password" |

The `href="/en/search"` present in `/vi` HTML is the language switcher's own target and is
correct.

## Quality gates

| Gate | Result |
| --- | --- |
| lint | PASS (1 pre-existing font warning in `layout.tsx`) |
| typecheck | PASS |
| test | PASS — 213 tests, 34 files |
| build | PASS — `/en` and `/vi` prerendered for all SSG routes |

## Remaining i18n risks

- `<html lang>` in raw HTML, as described above.
- Category names and descriptions come from the database and are English-only. Localizing
  them needs a schema change (`name_vi` / `description_vi`), which is out of scope here.
- Course titles and provider names are intentionally never translated — the source title
  stays authoritative.
- The admin dictionary is cookie-driven, so an admin who has never visited a public page
  and has no cookie sees English. That is the intended default.

Status: **M18_4_TRANSLATION_COMPLETENESS_COMPLETE**
