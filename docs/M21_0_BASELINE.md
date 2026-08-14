# M21.0 — v1.3 Runtime Audit & M21 Baseline

Date: 2026-08-14

## Audit answers

| # | Question | Finding |
|---|----------|---------|
| 1 | Coupon-related schema fields? | No `coupon_code` / offers tables. Coupon is `priceType=FREE_WITH_COUPON` only. |
| 2 | URL normalization strips query? | Strips tracking (`utm_*`, `fbclid`, …) only. Other params retained. |
| 3 | couponCode lost at ingest? | No special handling; would be kept by `normalizeUrl`, but identity is full URL — need canonical/offer split. |
| 4 | Udemy provider policy? | `FETCH_ALLOWED` + `REMOTE_ONLY` images; mixed catalog; FREE_WITH_COUPON → FREE_CERTIFICATE. |
| 5 | Discovery sources? | Tavily + `discovery_queries` (70 seeded, mostly Tech). |
| 6 | Taxonomy domains? | 12 categories, Tech-heavy (AI/Programming/Cloud…). Soft Skills + Business exist. |
| 7 | Distribution? | Runtime-dependent; no coupon offers stored. |
| 8 | Thumbnail source? | OG/JSON-LD → `imageSourceUrl`; display via `getCourseVisual()`. |
| 9–10 | Image coverage / broken rate? | No admin metrics yet; client onError fallback tile. |
| 11 | Public surfaces? | `[locale]/page`, category, topic, course-card, free-status-badge. |
| 12 | Admin surfaces? | discovery, candidates, taxonomy, courses, analytics, monetization. |
| 13 | Reuse? | Truth/verification, provider policy, ranking, search hybrid, outbound, VI UI. |
| 14 | Vietnamese-only? | Shipped (M20.14): `defaultLocale=vi`, language switcher OFF. |

## Known-positive coupon fixture (logic)

```text
provider       = UDEMY
canonical_url  = https://www.udemy.com/course/example-course/
offer_url      = https://www.udemy.com/course/example-course/?couponCode=TEST100OFF
coupon_code    = TEST100OFF
expected       = parser keeps coupon_code; canonical drops couponCode
```

## Baseline metrics (schema-ready; runtime values TBD without DB)

```text
published courses              — query courses.status=PUBLISHED
provider distribution          — group by provider
category distribution          — course_categories join
top-level domain distribution  — after M21.1 taxonomy map
course_image_coverage          — image_source_url OR image_storage_url not null
broken_image_rate              — image_status=BROKEN (new)
fallback_image_rate            — image_status=FALLBACK (new)
Udemy course count             — provider slug=udemy
Udemy active coupon count      — course_offers status=ACTIVE_100_OFF (new)
coupon discovery sources       — 0 (new registry)
discovery candidates/day       — course_candidates created_at
verified candidates/day        — verifications
```

## Gaps driving M21

1. No coupon offer identity (canonical vs offer URL vs code).
2. Discovery seeds starve non-Tech domains.
3. No FREE_PREVIEW access class; FREE_AUDIT wording needs clarity.
4. Media quality not observable in admin.
5. No "Miễn phí hôm nay" surface.
