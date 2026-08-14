# M20.14 — Vietnamese-Only Product Direction

Status: **SHIPPED (product direction)** — 2026-08-14

## Decisions

```text
PRIMARY PRODUCT LANGUAGE = vi
DEFAULT LOCALE            = vi
PUBLIC LANGUAGE SWITCHER  = hidden (PUBLIC_LANGUAGE_SWITCHER=false)
ADMIN UI LOCALE           = vi (getAdminLocale always returns vi)
```

## What stayed

- `/en/...` routes still resolve (SEO migration / bookmarks) — not mass-deleted
- English dictionary files remain for gradual content cleanup
- International course titles/provider names unchanged
- Vietnamese queries still retrieve English/international courses (search)

## What changed

- `defaultLocale` → `vi` in `src/lib/i18n/config.ts`
- Public + admin language switchers hidden
- Affiliate disclosure defaults prefer Vietnamese copy when locale is vi

## Follow-ups (ops)

1. Monitor Search Console for `/en` indexed URLs; add redirects when ready
2. Translate remaining EN-only marketing strings opportunistically
3. Do **not** restrict catalog to Vietnam-only providers
