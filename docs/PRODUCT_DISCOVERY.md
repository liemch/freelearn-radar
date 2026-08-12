# Product Discovery — FreeLearn Radar (M17)

## User journeys

1. **Beginner Python** → `/` search “Python” or `/free-courses/python` → course → View course
2. **AI learner** → `/free-courses/ai` or category AI → filter level → outbound
3. **PM** → `/free-courses/project-management`
4. **Free certificate** → `/free-certificate-courses` (FREE_CERTIFICATE only)
5. **Mobile Google visitor** → course page → clear free status + CTA

## Filters (shareable URLs)

`q`, `provider`, `level`, `price`, `certificate`, `durationMax`, `sort`, `page`

Pagination preserves these params via `catalogFiltersToQuery`.

## Collections

| Path | Rule |
|------|------|
| `/collections/under-1-hour` | `durationMinutes <= 60` |
| `/collections/under-5-hours` | `<= 300` |
| `/collections/weekend` | `<= 480` |

Missing duration → excluded.

## Search

- Normalize whitespace/control chars
- ILIKE title/description/provider (Postgres-compatible)
- Filtered results: page metadata `noindex`
- Ranking sort: recommended/newest/popular/shortest (SQL); homepage uses trust-aware `rankCourses`

## Related courses

Deterministic score: shared categories, provider, level, language, free type, quality; penalties for stale/unverified. Exclude self and non-PUBLISHED.

## Product events (privacy-conscious)

Logged via `trackProductEvent` (structured logs only):

- `course_view`, `course_outbound_click`, `search`, `category_view`, `provider_view`, `topic_view`, `collection_view`

No PII. Supports future CTR: views → outbound clicks.

## Conversion honesty

CTA copy: “View course on {provider}” + “You will leave FreeLearn Radar”.
No guaranteed-free language.
