# FreeLearn Radar — v1.3.2 / M23 FINAL REPORT

**Status:** COMPLETE (implementation)  
**Date:** 2026-08-15  
**Baseline:** v1.3 / M20–M21 + M22.0 UI/UX  
**Commit / push / deploy:** **NOT done** (per plan)

---

## 1. SUMMARY

M23 closes the operational gaps left after M22:

1. **Course media** — Admin override + actionable Media Quality + single-course resolve (flag-independent for Admin).
2. **Course lifecycle** — Archive / Restore / Purge with dependency classification; form PATCH no longer bypasses status transitions.
3. **Affiliate / Shopee** — Operator-facing `affiliate_products` + Admin CRUD + public “Góc học tập” + `/go/affiliate?product=`.
4. **Post-M22 hardening** — Branding revalidation for SSG topic shells; Admin ops filters/dashboard drill-downs.

Truth, coupon eligibility, ranking, and Vietnamese public UI invariants are preserved.

---

## 2. M23.0 AUDIT (findings → fixes)

| Area | Root cause / gap | Fix |
|---|---|---|
| Media | Resolver gated by `FEATURE_MEDIA_RESOLVER`; no Admin override UI | Override table + APIs + UI; Admin `resolveCourseMediaById` bypasses flag |
| Media | Presentation did not prefer Admin override | `getCourseVisual` priority: override → resolved → storage → source |
| Lifecycle | No Restore / Purge; form PATCH could set status freely | Lifecycle domain + APIs + UI; PATCH ignores form status |
| Lifecycle | Coupon recheck ignored course status | `listOffersDueForRecheck` only PUBLISHED (or orphan offers) |
| Affiliate | Could not add Shopee product end-to-end | `affiliate_products` + Admin + public placements + click hop |
| Branding | SSG topic pages baked default logo at build | `revalidatePublicBranding()` + `revalidate = 3600` on topic pages |

---

## 3. SCHEMA / MIGRATION

**File:** `drizzle/0015_m23_media_lifecycle_affiliate.sql`

- `course_image_source_type` += `ADMIN_OVERRIDE`
- `courses.image_override_url`, `courses.duplicate_of_course_id`
- `course_media_overrides` (bounded bytea / remote URL)
- `affiliate_products`, `affiliate_product_contexts`
- `affiliate_clicks.product_id`

**Bootstrap:** `scripts/neon-bootstrap.sql` regenerated (16 migrations including `0015`).

---

## 4. COURSE MEDIA (M23.1)

- Presentation priority enforced in `src/domain/course/course-visual.ts`
- Override domain: `src/domain/media/course-image-override.ts`
- Public serve: `GET /api/course-media/[courseId]`
- Admin: `PATCH /api/admin/courses/[id]/image` (upload / URL / clear / resolve)
- Admin UI panel on course edit + Media Quality actions/filters
- Override does **not** overwrite `image_source_url` evidence
- Clear override restores automatic pipeline fields

**Upload limits:** PNG/JPEG/WebP; dedicated `course_media_overrides` (not `site_assets`).

---

## 5. COURSE LIFECYCLE (M23.2)

| Action | Behavior |
|---|---|
| Unpublish | `PUBLISHED` → `DRAFT` via status API |
| Archive | → `ARCHIVED` (hidden from public + coupon recheck) |
| Restore | `ARCHIVED` → `DRAFT` (never auto-republish) |
| Duplicate mark | Archive + `duplicate_of_course_id` |
| Purge | ADMIN only; slug/title confirm + reason; dependency guard |

**Classification:** `SAFE_TO_PURGE` | `PURGE_WITH_SAFE_CASCADE` | `BLOCKED_BY_HISTORY`

**P0 closed:** Course form status dropdown removed on edit; PATCH keeps existing status.

---

## 6. AFFILIATE / SHOPEE (M23.3–5)

- Admin: `/admin/affiliate/products` (+ detail/contexts)
- Public: Course Detail “Góc học tập” via product contexts + flags
- Outbound: `/go/affiliate?product=…` (tracking failure does not block redirect)
- Flags unchanged: `FEATURE_MONETIZATION`, `FEATURE_COMMERCE_AFFILIATE`
- URL validation rejects open redirects / foreign hosts / unsafe schemes

---

## 7. ADMIN OPS + HARDENING (M23.6–7)

- Course list filters: published / draft / archived / missing / broken / fallback / Admin image / duplicates
- Dashboard work queue: missing images, broken images, archived
- Branding: `revalidatePath` after Admin branding mutations; topic ISR 1h

---

## 8. QUALITY GATES

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** (pre-existing font warning in `layout.tsx`) |
| `npm test` | **PASS** — **630** tests |
| `npm run build` | **PASS** |
| `npm run db:bootstrap:generate` | **PASS** (includes `0015_m23_media_lifecycle_affiliate`) |

New tests:

- `src/test/m23-affiliate.test.ts`
- `src/test/m23-lifecycle-media.test.ts`

---

## 9. INVARIANTS CHECK

| Invariant | Status |
|---|---|
| Truth ≠ ranking | Unchanged |
| Image ≠ eligibility | Unchanged |
| Affiliate ≠ Truth/ranking | Unchanged |
| Only ACTIVE_100_OFF → “Coupon 100%” | Unchanged |
| Public UI Vietnamese | Preserved |
| Archive ≠ Unpublish ≠ Purge | Enforced |

---

## 10. MANUAL / OPS FOLLOW-UP

1. Deploy migration `0015` (or rely on `vercel-build` migrate) before Admin media/affiliate product features work in production.
2. Enable `FEATURE_MEDIA_RESOLVER=true` if automatic cron media resolution should run (Admin single-course resolve works without it).
3. Enable monetization flags only when ready to show commerce publicly.
4. Smoke: Admin upload course image → card/detail show override → clear → automatic returns.
5. Smoke: Archive course → absent from public/search/sitemap → Restore → still draft → Publish.
6. Smoke: Add Shopee product → map course → ACTIVE → “Góc học tập” → click → redirect + click row.

---

## 11. ASSUMPTIONS

- Restore lands on `DRAFT` (existing “unpublished” analogue); no new status enum.
- Postgres bytea for rare Admin course overrides is acceptable with size caps; not a bulk CDN.
- Purge with historical clicks/offers remains blocked (prefer Archive).
- No production data mutation performed in this task.

---

**DO NOT COMMIT / PUSH / DEPLOY** — per M23 plan. This report ends v1.3.2 / M23 implementation work.
