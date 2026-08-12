# SEO Architecture — FreeLearn Radar (M17)

## Route strategy

| Route | Purpose | Index |
|-------|---------|-------|
| `/` | Homepage discovery | yes |
| `/search` | Keyword + filters | yes (base only) |
| `/search?*` | Filtered search | **noindex, follow** |
| `/category/[slug]` | Category browse | yes (base) |
| `/category/[slug]?*` | Filtered | **noindex, follow** |
| `/course/[slug]` | Course detail (published) | yes |
| `/course/[slug]` expired/unavailable | History | noindex |
| `/provider/[slug]` | Provider collection | yes |
| `/free-courses/[topic]` | Topic SEO landing | yes (only if courses exist) |
| `/free-certificate-courses` | FREE_CERTIFICATE only | yes |
| `/collections/[slug]` | Duration collections | yes |
| `/best/[year]/[month]` | Monthly ranked collection | yes |
| `/admin/*`, `/api/*` | Private | disallow + noindex |

## Canonical rules

- Each indexable page sets a stable canonical without filter params.
- Course canonical: `/course/{slug}`
- Topic canonical: `/free-courses/{topic}`
- Provider canonical: `/provider/{slug}`

## Structured data

- `Course` JSON-LD on course pages (no fabricated ratings/prices/reviews)
- `ItemList` on topic / certificate / monthly collections
- `Organization` on provider pages
- `BreadcrumbList` on course pages

## Sitemap

Includes: home, search base, topics, providers, categories, certificate page, duration collections, recent best months, published courses.

Excludes: admin, API, candidates, draft courses.

## Internal linking

Course → provider, categories, monthly best, related courses  
Category → topic landing, certificate collection  
Homepage → topics, providers, collections  

Avoid link spam: limited related set (≤4), curated topic related links.

## Thin page prevention

Topic landings `notFound()` when category missing or zero published courses (unfiltered).
