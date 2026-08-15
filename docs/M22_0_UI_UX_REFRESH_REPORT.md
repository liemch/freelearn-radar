# M22.0 UI/UX REFRESH REPORT

## 1. AUDIT

### Existing architecture found
- Next.js App Router public site under `src/app/[locale]/*`
- Admin console under `src/app/admin/*` with RBAC (`ADMIN` / `EDITOR`), audit log, Vietnamese admin dictionary
- Tailwind v4 + CSS variables in `src/app/globals.css`; shadcn primitives in `src/components/ui/*`
- Course media: remote URL pipeline (`course-image-service`, media resolver) — **no object storage / upload API**
- No site settings table before M22.0; branding was hardcoded (`BrandMark`, `icon.tsx`, dictionaries)

### Existing UI found
- Homepage, header, search/catalog, course card/detail, category/topic/collections, Miễn phí hôm nay, trust strip, empty/loading states
- **Blog: does not exist**

### Media/upload architecture found
- Course images: SSRF-safe fetch + remote URLs only
- No multipart upload endpoints; no Vercel Blob / S3
- **M22 approach:** small branding assets stored in Postgres `site_assets` (bytea) + public `/api/site-assets/[key]`, text config in singleton `site_settings`

---

## 2. IMPLEMENTED

| Surface | Status |
|---|---|
| Header | Compact sticky header, nav, HOT badge on daily free, compact search (desktop + mobile drawer) |
| Homepage | Reordered: Hero → Trust → Domains → Daily free → Durable → Recent → Help CTA → Providers → Monthly |
| Hero | Two-column layout; Admin eyebrow/title/description/placeholder/image; quick topic chips (real links) |
| Trust metrics | Real published count, provider count, active 100% coupons, last verified — no invented figures |
| Categories | `CategoryDiscovery` grid from real taxonomy + icon mapping |
| Miễn phí hôm nay | Homepage section + existing dedicated page; Truth badges unchanged |
| Course cards | Shared card: softer radius/shadow, truth badges, freshness |
| Catalog | Search page header panel polish; existing filters/grid/pagination preserved |
| Course Detail | Stronger media card; CTA wording by access type (`Vào học miễn phí` / `Nhận khóa học miễn phí` / provider fallback); outbound `/go` unchanged |
| Blog | **NOT IMPLEMENTED — OUT OF SCOPE** |
| Admin branding | `/admin/branding` — Thương hiệu + Trang chủ |
| Admin homepage config | Hero copy + hero image upload/clear |

---

## 3. ADMIN CONFIGURATION

### Fields
- `heroEyebrow`, `heroTitle`, `heroDescription`, `searchPlaceholder`, `heroImageAlt`
- Asset keys: `logo`, `logo_compact`, `favicon`, `hero`

### Upload behavior
- `PATCH /api/admin/branding` multipart (`file` + `key`) or JSON text patch
- MIME allowlist: PNG / JPEG / WebP (+ ICO for favicon only)
- Size caps: logo 512KB, compact 256KB, favicon 128KB, hero 1MB
- `assertAdmin` + `writeAuditLog` (no binary in audit)

### Fallback
- Missing/cleared assets → `BrandMark` / dictionary hero defaults / built-in `icon.tsx`
- Invalid/missing asset URL → header/homepage remain usable

### Cache / revalidation
- Public pages that are dynamic re-read branding each request (`force-dynamic` / runtime)
- Build phase skips branding DB (`NEXT_PHASE === phase-production-build`) to avoid static-gen hangs when `site_settings` is absent
- Asset responses: `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` with `?v=` busting
- No `revalidatePath` layer existed; Admin save uses `router.refresh()`

---

## 4. REUSED

- Admin shell / nav / page header / RBAC / audit log patterns
- `withDb` fail-open
- Course visual / media pipeline (unchanged)
- Truth / free status badges / daily-free / coupon ACTIVE_100_OFF semantics
- Lexical/hybrid search + catalog filters
- Outbound `/course/[slug]/go` and affiliate separation
- i18n dictionaries (extended, Vietnamese-only product direction)

---

## 5. NEW COMPONENTS / MODULES

- `src/db/schema/site-branding.ts`
- `src/db/repositories/site-branding-repository.ts`
- `src/domain/branding/site-branding.ts`, `build-guard.ts`
- `drizzle/0014_m22_site_branding.sql`
- `src/app/api/site-assets/[key]/route.ts`
- `src/app/api/admin/branding/route.ts`
- `src/app/admin/branding/page.tsx`
- `src/components/admin/branding-edit-form.tsx`
- `src/components/brand/brand-logo.tsx`
- `src/components/public/category-discovery.tsx`
- `src/components/public/smart-discovery-cta.tsx`
- Tests: `src/test/m22-branding.test.ts`, `src/test/m22-ui-wiring.test.ts`

---

## 6. DATA GAPS (reference elements NOT rendered)

| Reference element | Reason |
|---|---|
| Fake stats (12,684+ / 98.7% / 30+) | Not real — trust strip uses live aggregates only |
| Star ratings / review counts / learner counts on cards | `rating` / `ratingCount` exist for ranking only; not treated as trustworthy public display yet |
| Video play overlay on detail | No preview/video URL field |
| Bookmark / notification / user avatar in header | No public auth / bookmark product surface |
| Blog listing | No blog routes/CMS |
| “Nền tảng đối tác uy tín” + Harvard/MIT logos | No partnership evidence — replaced with “Nền tảng đang có khóa học trên Radar” |
| Empty “Đánh giá / Giảng viên / Nội dung” tabs | No content → tabs not invented |

---

## 7. INTENTIONALLY NOT IMPLEMENTED

- Generic CMS / page builder / theme editor
- SVG uploads (unsafe without existing SVG policy)
- Object storage (Blob/S3) second media system
- Fake partners, ratings, video, bookmarks
- Blog CMS
- Changing Truth Engine, coupon semantics, ranking eligibility, provider policy

---

## 8. RESPONSIVE REVIEW

| Width | Expectation after refresh |
|---|---|
| 375 / 430 | Mobile nav drawer + search; stacked hero; 1–2 col cards; touch targets ≥44px on controls |
| 768 | 2-col grids; filters usable |
| 1024 | Header nav + compact search; hero two-column when image present |
| 1440 | `max-w-6xl` page gutter; course grid auto-fill ~4 columns |

Manual browser pixel QA still recommended (see §14).

---

## 9. ACCESSIBILITY

- Semantic headings preserved; search forms labelled; focus rings via global `:focus-visible`
- Free status still via badge text (not color alone)
- Image alts for Admin hero; BrandLogo uses site title
- `prefers-reduced-motion` already global
- HOT badge is supplementary text next to “Miễn phí hôm nay”

---

## 10. PERFORMANCE

- No new animation libraries
- Branding assets are small DB blobs; course images stay on existing pipeline
- Build skips branding DB to avoid connection pile-up during SSG
- Homepage still uses parallel `withDb` aggregates; active coupon count reuses `listActive100OffOffers` (bounded)

---

## 11. REGRESSION

| Area | Result |
|---|---|
| Truth badges / eligibility | Unchanged domain logic |
| Coupon ACTIVE_100_OFF | Unchanged; trust metric counts real active offers |
| Search / filters | Wiring preserved |
| Media pipeline | Untouched |
| Outbound `/go` | Preserved; CTA label only |
| Vietnamese UI | Public + Admin Vietnamese; no language switcher return |

---

## 12. QUALITY GATES

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** (pre-existing font warning in `layout.tsx`) |
| `npm test` | **PASS** (620 tests) |
| `npm run build` | **PASS** |
| `npm run db:bootstrap:generate` | **PASS** (includes `0014_m22_site_branding`) |

---

## 13. VISUAL REVIEW

Closer to reference in: emerald primary, roomier radius/shadows, hero search prominence, category icon cards, course card density, catalog header, detail CTA panel, header compact search.

Remaining differences (by design):
- No illustrative 3D character unless Admin uploads a hero image
- No fake ratings / partner strip / blog
- FreeLearn Radar truth/freshness vocabulary kept more prominent than the mockup

---

## 14. MANUAL REVIEW NEEDED

1. **Deploy migration `0014_m22_site_branding`** on Neon (or rely on `vercel-build` migrate) before Admin uploads work in production.
2. Upload real logo + hero artwork in **Admin → Cấu hình giao diện** and visually confirm homepage/header.
3. Confirm whether SSG topic landings (`/free-courses/*`) should become `force-dynamic` so logo changes appear there without rebuild (homepage/admin already runtime-friendly).
4. Optional later: object storage if branding assets outgrow Postgres bytea.

---

**DO NOT COMMIT / PUSH / DEPLOY** — per task instructions. This report ends M22.0 implementation work.
