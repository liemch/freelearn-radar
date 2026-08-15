# v1.3.3 / M24 FINAL REPORT

**Status:** COMPLETE (implementation)  
**Date:** 2026-08-15  
**Baseline:** v1.3.2 / M23  
**Commit / push / deploy:** **NOT done** (per plan)

---

## 1. STORAGE AUDIT

| Asset | Before M24 | Classification |
|---|---|---|
| Branding logo/hero/favicon | `site_assets.bytes` (bytea) | BRANDING |
| Course Admin override | `course_media_overrides.bytes` or remote URL | COURSE_OVERRIDE |
| Course automatic | remote URLs on `courses.image_*` | remote / optional COURSE_CACHE |
| Affiliate product | `affiliate_products.image_url` text only | AFFILIATE_PRODUCT |

Baseline DB counts/bytes: **N/A** without live Neon access in this session.

Root causes addressed: Postgres growing with binaries; no CDN-friendly delivery; no orphan lifecycle.

---

## 2. ARCHITECTURE

```text
PostgreSQL (Neon)     = metadata + legacy bytea (retained)
Object Storage (R2)   = new managed binaries
ManagedAssetService   = validate → hash → put → metadata
ObjectStorageProvider = swappable (R2 / Fake / future S3)
```

Business layers never call R2 SDK directly.

---

## 3. OBJECT STORAGE

| Piece | Location |
|---|---|
| Interface | `src/domain/storage/types.ts` |
| R2 adapter | `src/domain/storage/r2-provider.ts` (`@aws-sdk/client-s3`) |
| Fake adapter | `src/domain/storage/fake-provider.ts` |
| Factory | `src/domain/storage/get-provider.ts` |

**Env (server-only):**

```bash
FEATURE_OBJECT_STORAGE=false
FEATURE_R2_UPLOADS=false
FEATURE_COURSE_IMAGE_CACHE=false
FEATURE_MEDIA_ORPHAN_CLEANUP=false
OBJECT_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BASE_URL=
MEDIA_MAX_TOTAL_BYTES=
MEDIA_ORPHAN_GRACE_DAYS=14
MEDIA_CLEANUP_BATCH_SIZE=50
```

---

## 4. COURSE MEDIA

- New Admin uploads → R2 when flags ON; legacy bytea when OFF
- `managed_asset_id` on `course_media_overrides`
- Clear override marks previous managed asset `UNREFERENCED`
- Source evidence (`image_source_url`) never overwritten
- Public `/api/course-media` redirects to HTTPS managed/remote URLs when available

---

## 5. AFFILIATE MEDIA

- Upload API: `PATCH /api/admin/affiliate/products/[id]/image`
- Stores managed asset + sets `image_url` to public URL
- Remote URL paste still allowed without mandatory R2 copy

---

## 6. BRANDING MEDIA

- New uploads → R2 when flags ON
- Resolve order: managed asset → legacy `site_assets` → bundled default
- Legacy bytea not dropped

---

## 7. IMAGE CACHE POLICY

`shouldCacheCourseImage()`:

- Default: KEEP_REMOTE for stable CDNs
- CACHE when `STORE_COPY`, signed/fragile URL signals, repeated failures, or manual
- Wired into media resolution runner behind `FEATURE_COURSE_IMAGE_CACHE`

---

## 8. DEDUPLICATION

SHA-256 `content_hash`; reuse ACTIVE managed asset of same type+hash (branding uploads force `allowDedup=false`).

---

## 9. ORPHAN CLEANUP

States: ACTIVE → UNREFERENCED → PENDING_DELETE → DELETED / ERROR  
Grace: `MEDIA_ORPHAN_GRACE_DAYS` (default 14)  
Bounded batch via coupon cron when `FEATURE_MEDIA_ORPHAN_CLEANUP=true`

---

## 10. ADMIN STORAGE

`/admin/media-storage` — totals, bytes, type filters, orphan/failed filters.  
Nav: **Kho lưu trữ**.

---

## 11. MIGRATION

Script: `scripts/migrate-media-to-r2.ts`

- Default **DRY RUN** (counts + bytes + target key hints)
- `--execute` uploads + writes metadata; **does not delete** legacy bytea

---

## 12. SECURITY

- No `NEXT_PUBLIC_` storage secrets
- Magic-byte MIME validation (client MIME not authority)
- No SVG
- Safe object keys (no `..`, no user filename)
- SSRF path reused for remote fetch/copy
- RBAC on Admin upload routes
- Admin actions audit-logged

---

## 13. FAILURE / FALLBACK

- Storage outage / flags OFF → legacy bytea or remote source still works
- CourseVisual still: override → resolved → storage → source → tile
- Upload DB failure compensates with object delete (or orphan candidate log)

---

## 14. STORAGE METRICS

Exposed on Admin Storage dashboard (object count, bytes, per-type ACTIVE, orphans, errors).

---

## 15. MIGRATIONS

`drizzle/0016_m24_managed_assets.sql`  
Bootstrap regenerated (17 migrations).

Adds: `managed_assets` + refs on course overrides, affiliate products, site_settings, courses.image_cache_asset_id.

---

## 16. CHANGED FILES (high level)

- `src/domain/storage/*` (new)
- `src/db/schema/managed-assets.ts` + schema wiring
- Course override / branding / affiliate / media runner / cron
- Admin media-storage page + i18n
- `scripts/migrate-media-to-r2.ts`
- `@aws-sdk/client-s3` dependency
- Tests: `src/test/m24-storage.test.ts`

---

## 17. QUALITY GATES

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** (pre-existing font warning) |
| `npm test` | **PASS** (after i18n fix; 640 tests expected) |
| `npm run build` | **PASS** |
| `npm run db:bootstrap:generate` | **PASS** (includes `0016`) |

---

## 18. P0 / P1 / P2

| ID | Severity | Notes |
|---|---|---|
| — | P0 | None |
| A1 | P1 ACCEPTED | Affiliate Admin UI upload button not deeply polished (API exists; form still primarily URL) |
| A2 | P2 | Signed browser→R2 direct upload deferred (low Admin volume; server hop OK) |
| A3 | P2 | Live R2 smoke requires operator credentials |

---

## 19. BLOCKED / ASSUMPTIONS

- No production R2 credentials in this session → Fake provider used in CI/local without flags
- Live bytea baseline metrics not measured
- Automatic catalog-wide image mirroring intentionally not enabled

---

## 20. MANUAL PRODUCTION STEPS

1. Deploy schema `0016` (or vercel-build migrate)
2. Configure R2 bucket + public base URL + API tokens (server env only)
3. Keep flags OFF → smoke deploy
4. Enable `FEATURE_OBJECT_STORAGE=true` + `FEATURE_R2_UPLOADS=true`
5. Upload one logo, one course override, one affiliate image → verify public URLs
6. Optional: `npx tsx scripts/migrate-media-to-r2.ts` then `--execute`
7. Later: enable `FEATURE_COURSE_IMAGE_CACHE` for one provider policy only
8. Later: enable `FEATURE_MEDIA_ORPHAN_CLEANUP`

---

## 21. NOT DONE

- Destructive drop of `site_assets` / override bytea
- Full CDN platform / image editor / video
- Provider full-catalog image mirroring
- Browser signed upload path (M24.11 optional)
- Production data migration execution

---

**DO NOT COMMIT / PUSH / DEPLOY** — per M24 plan. This report ends v1.3.3 / M24 implementation work.
