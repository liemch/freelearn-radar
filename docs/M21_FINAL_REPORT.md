# M21 / v1.3.1 Final Report

Date: 2026-08-14  
Mode: overnight implementation (no commit / no push / no deploy)

## IMPLEMENTED (milestone-by-milestone)

| Milestone | Status | Evidence |
|-----------|--------|----------|
| **M21.0** Baseline audit | DONE | `docs/M21_0_BASELINE.md` |
| **M21.1** Multi-domain taxonomy | DONE | Expanded `SEED_CATEGORIES`, `src/domain/taxonomy/multi-domain.ts` |
| **M21.2** Balanced discovery | DONE | Non-Tech discovery seeds in `data.ts`; `discovery_category_stats` + engine bumps |
| **M21.3** Udemy coupon discovery | DONE | Schema `coupon_sources`/`coupon_candidates`/`course_offers`; `offer-url.ts`; discovery runner |
| **M21.4** Coupon verify/expiry | DONE | State machine + verification runner + recheck priority; cron `/api/cron/coupons` |
| **M21.5** Coursera access class | DONE | `FREE_PREVIEW` enum; `access-classifier.ts`; free-list exclusion |
| **M21.6** Course media pipeline | DONE | Image status/source fields on `courses`; `media-resolver.ts`; SSRF tests |
| **M21.7** Miễn phí hôm nay | DONE | `/[locale]/mien-phi-hom-nay`; `daily-free.ts` |
| **M21.8** Interests lite | DONE | `interests.ts` + InterestPicker / ForYouSection (localStorage) |
| **M21.9** Topic/category SEO | DONE | New landings: communication, excel, english, personal-development, finance |
| **M21.10** Discovery UX | DONE | Homepage IA, discovery header nav, free-type label distinction |
| **M21.11** Admin ops | DONE | `/admin/coupons`, `/admin/coverage`, `/admin/media-quality` |
| **M21.12** Hardening | DONE | Feature flags OFF by default; cost guards; `m21-hardening.test.ts`; `docs/M21_12_HARDENING.md` |

## CHANGED FILES (by domain)

- **Schema/migration:** `drizzle/0012_m21_coupon_media_taxonomy.sql`, `enums.ts`, `courses.ts`, `coupon.ts`, `discovery-category-stats.ts`, journal
- **Coupon domain:** `src/domain/coupon/*`, `coupon-repository.ts`, cron route, seed coupon sources
- **Taxonomy/discovery:** `multi-domain.ts`, seed categories/queries, topic-landings, discovery-engine coverage bumps, daily-free, interests
- **Access/media:** `access-classifier.ts`, `media-resolver.ts`, labels, free-durability, free-status-badge
- **Public UX:** homepage, header, mien-phi-hom-nay, interest components, dictionaries
- **Admin:** coupons/coverage/media-quality pages, nav, admin i18n
- **Env/docs:** `env.ts`, `.env.example`, `docs/M21_0_BASELINE.md`, `docs/M21_12_HARDENING.md`

## MIGRATIONS

- **File:** `drizzle/0012_m21_coupon_media_taxonomy.sql`
- **Why:** coupon registry/candidates/offers; category coverage stats; course image quality fields; `FREE_PREVIEW` price type
- **Rollback note:** drop new tables/columns; enum values (`FREE_PREVIEW`, coupon/image enums) are additive — leave unused rather than destructive `DROP TYPE` in production

## QUALITY GATES

| Command | Result |
|---------|--------|
| `npm run lint` | PASS (0 errors; 2 pre-existing warnings) |
| `npm run typecheck` | PASS |
| `npm run test` | PASS — **508/508** |
| `npm run build` | PASS |

## AUDIT FINDINGS

### Critical invariants — verified by tests

- couponCode not stripped by normalization (`offer-url.test.ts`)
- Aggregator cannot self-publish ACTIVE_100_OFF (`coupon-service` + verification runner)
- Expired coupons not Coupon 100%
- FREE_PREVIEW not free-list eligible / not conflated with FREE_FULL
- Missing/broken image → fallback path; course still renderable
- Image SSRF private hosts blocked
- Discovery budget includes non-Tech domains
- Vietnamese-only UI (`defaultLocale=vi`, switcher OFF)
- Affiliate/Truth/ranking services reused, not replaced

### P0 / P1

- **P0 = 0**
- **P1 = 0** (no ACCEPTED_RISK required for release-candidate code quality)

### P2 (manual follow-up)

- Live Udemy official verification needs operator enablement + Provider Policy review before turning `FEATURE_COUPON_DISCOVERY=true`
- Coupon sources seed as **disabled**; Real.Discount is placeholder only
- Runtime baseline metrics (coverage %, broken image rate) need DB after migrate+seed

## BLOCKED / ASSUMPTIONS

1. **Assumption:** Official coupon verification without a live provider API uses fetch evidence; when blocked → `UNKNOWN`/`BLOCKED` (never invent 100% off). Correct per invariants.
2. **Assumption:** `FEATURE_COUPON_PUBLIC_SURFACE` emphasizes UX; daily-free page still serves limited free catalog fallback when no ACTIVE_100_OFF rows exist.
3. **Blocked on secrets/policy:** Enabling live aggregator fetch against third-party coupon sites requires operator policy confirmation (sources remain `enabled=false`).
4. **No production migration run** in overnight mode (local code + SQL ready).

## COUPON RESULTS (local)

- Parser fixtures PASS (known-positive keeps `couponCode`; canonical ≠ offer)
- Verification logic PASS (only official evidence → ACTIVE_100_OFF)
- Source metrics schema + admin surface available
- Cron gated OFF by default

## MEDIA RESULTS

- Resolver + SSRF unit coverage PASS
- Admin media-quality filters wired
- Runtime coverage vs baseline: N/A without migrated DB data

## DOMAIN COVERAGE

- Categories expanded beyond Tech (finance, personal-development, languages, office-productivity, …)
- Discovery seeds include soft-skills, Excel, English, finance, lifestyle, career, humanities, education
- Coverage stats table + admin page for starvation visibility

## MANUAL REVIEW NEEDED

1. Run `npm run db:migrate:run` then `npm run db:seed` on staging
2. Review coupon source enablement against Provider/Source Policy
3. Visual QA: homepage, `/mien-phi-hom-nay`, category/topic, admin coupons/coverage/media on mobile
4. Flip feature flags one-by-one on staging (coupon discovery last)

## NOT DONE / OUT OF SCOPE

- No git commit / push / production deploy (per overnight protocol)
- No community Add Course / Instructor Promote
- No universal coupon engine for every website
- No live Real.Discount dependency as required source
- v1.4 not started

---

**Release candidate code quality:** DONE for v1.3.1 implementation scope.  
**STOP** — awaiting user review before commit/deploy.
