# FreeLearn Radar — v1.3.2 / M23

## Operational Completion, Course Media, Lifecycle & Commerce Affiliate

You are working on the EXISTING FreeLearn Radar repository.

# CURRENT BASELINE

The following versions are already implemented:

* v1.3 / M20
* v1.3.1 / M21
* M22.0 Product UI/UX Refresh

M22.0 has already completed with:

* refreshed public UI/UX
* Admin-managed branding
* `site_settings`
* `site_assets`
* logo / hero upload
* Vietnamese-only UI preserved
* Truth / coupon / search / outbound logic preserved
* 620 tests PASS
* lint PASS
* typecheck PASS
* build PASS

IMPORTANT:
Do NOT reimplement M20, M21 or M22.

This task is:

# v1.3.2 / M23

Operational Completion, Course Media, Course Lifecycle,
Affiliate Product Operations and Post-M22 Hardening.

==================================================
PRIMARY GOAL
============

Finish operational gaps that remain visible after M22.

The four required tracks are:

1. COURSE MEDIA COMPLETION

   * discovered/published courses frequently have missing images
   * audit the actual media pipeline
   * fix the root cause
   * add Admin manual image override
   * improve Media Quality operations

2. COURSE LIFECYCLE

   * current workflow mainly supports publish/unpublish
   * implement Archive / Restore
   * add safe Permanent Delete / Purge
   * add dependency guards
   * avoid permanent accumulation of useless/test/duplicate courses

3. AFFILIATE / SHOPEE END-TO-END

   * v1.3 includes affiliate foundation and contextual placements
   * operator experience is not proven end-to-end
   * Admin must be able to add a Shopee product/link
   * map it to course/topic/category
   * preview it
   * activate it
   * render it publicly
   * track the click
   * redirect safely

4. POST-M22 HARDENING

   * verify refreshed UI reads the correct runtime data
   * verify branding cache behavior
   * verify no Truth/coupon/search/media/affiliate regression

==================================================
NON-NEGOTIABLE INVARIANTS
=========================

Preserve all existing FreeLearn Radar rules.

## TRUTH

Truth determines public eligibility.

Ranking determines ordering only AFTER eligibility.

Do not change Truth Engine merely to simplify UI.

FREE_FULL != FREE_AUDIT
FREE_FULL != FREE_PREVIEW
FREE_FULL != FREE_TRIAL

Only verified ACTIVE_100_OFF offers may display "Coupon 100%".

Expired/unverified coupons must not remain surfaced as active free offers.

## MEDIA

Image availability must NEVER determine course eligibility.

A valid course without image remains a valid course.

Never use:

* Google Images scraping
* random third-party images
* AI-generated images presented as official course thumbnails

## AFFILIATE

Affiliate/revenue/commission must NEVER influence:

* Truth
* eligibility
* organic ranking
* search relevance
* course quality

Commerce content is secondary.

Learning content remains primary.

Do not auto-redirect users.

Do not fake:

* discount
* urgency
* scarcity
* price

## LIFECYCLE

Unpublish != Archive != Permanent Delete.

Archive is the normal removal path.

Permanent Delete is exceptional.

Do not destroy important historical/audit data silently.

## GENERAL

Public UI remains Vietnamese-only.

Official course/provider names may remain in original language.

Reuse existing:

* RBAC
* audit log
* Truth Engine
* coupon verification
* source fetch policies
* search/ranking
* course media pipeline
* outbound tracking
* Admin shell
* branding/media upload patterns
* feature flags

Do not create parallel systems when equivalent capability already exists.

==================================================
EXECUTION MODE
==============

Run the task continuously from M23.0 through M23.8.

Do NOT stop between milestones unless encountering:

* destructive irreversible migration
* security invariant conflict
* Truth invariant conflict
* required secret/credential unavailable
* production data mutation requirement
* architecture ambiguity with high blast radius

For normal ambiguity:

choose the safest conservative implementation,
record assumption,
continue.

DO NOT:

* git commit
* git push
* deploy production
* mutate production data

==================================================
M23.0 — TARGETED RUNTIME AUDIT
==============================

Do an AUDIT FIRST.

Do not change code during the audit phase.

Audit only these three areas deeply:

A. COURSE MEDIA
B. COURSE LIFECYCLE
C. AFFILIATE / SHOPEE

Also verify M22 wiring relevant to those areas.

---

## A. COURSE MEDIA AUDIT

Inspect actual code/schema/runtime wiring for:

* discovery result image metadata
* `image_source_url`
* resolved image fields
* course media entity/table if any
* image resolver
* image validator
* provider image policy
* remote image fetching
* fallback logic
* CourseCard image selection
* Course Detail image selection
* Admin media views
* background media resolution jobs

Classify missing-image root causes:

A. source did not expose image
B. image extracted but not persisted
C. image persisted but resolver never runs
D. resolver rejects image
E. provider/CDN blocks access
F. DB has image but UI does not use it
G. stale/broken image
H. fallback is incorrectly selected
I. job/runtime wiring missing
J. other

Produce baseline if data can be obtained locally:

* published course count
* course_image_coverage
* official_image_rate
* trusted_metadata_rate
* fallback_image_rate
* broken_image_rate
* missing_image_rate

---

## B. COURSE LIFECYCLE AUDIT

Inspect:

* course status enum/model
* publish flow
* unpublish flow
* archive support
* restore support
* delete endpoints/actions
* public eligibility
* search eligibility
* sitemap
* category/topic pages
* homepage
* recommendations
* verification jobs
* observation/monitor jobs
* embeddings
* coupon offers
* media
* outbound_clicks
* affiliate placements
* audit references
* foreign key policies

Build a dependency map for a course.

Determine:

* archive already exists?
* restore already exists?
* archived course excluded from public?
* archived course excluded from jobs?
* hard delete exists?
* cascade behavior?
* orphan risk?
* valuable history that must be preserved?

---

## C. AFFILIATE / SHOPEE AUDIT

Inspect actual implementation for:

* affiliate providers
* campaigns
* placements
* click tracking
* AffiliateLinkService or equivalent
* feature flags
* Admin monetization navigation
* Admin provider pages
* Admin campaigns
* Admin placements
* public contextual affiliate sections

For each capability mark:

IMPLEMENTED
WIRED
VISIBLE
USABLE
TESTED

Audit specifically:

Can an Admin currently do this?

1. add a Shopee product/link
2. add product title
3. add product image
4. define merchant
5. map to course/topic/category
6. preview placement
7. activate
8. see it on public Course Detail
9. click
10. record analytics
11. redirect correctly

If not, state exactly where the chain breaks.

---

## M22 WIRING CHECK

Check that new M22 UI still uses:

* real course media
* real coupon state
* real offer_url
* real verified timestamps
* real affiliate placement data
* real course status

Do not rely only on tests.

==================================================
GATE M23.0
==========

Before implementation, produce internal findings:

MEDIA ROOT CAUSE
LIFECYCLE DEPENDENCY MAP
AFFILIATE RUNTIME MATRIX
P0/P1/P2 FINDINGS

Then proceed automatically.

==================================================
M23.1 — COURSE MEDIA COMPLETION
===============================

Goal:

Make course thumbnails reliable while preserving existing M21 media architecture.

Do NOT build a second media pipeline if the existing one is repairable.

Fix root cause first.

---

## IMAGE RESOLUTION PRIORITY

Final presentation priority must be:

1. ADMIN_OVERRIDE
2. OFFICIAL_PROVIDER
3. TRUSTED_METADATA
4. VALIDATED_CACHED_IMAGE
5. BRANDED_FALLBACK

Admin override changes presentation only.

It must NOT overwrite source evidence.

Example:

official source:
coursera.com/image-a.jpg

admin override:
managed-media/course-123.webp

UI:
uses override

Source evidence:
keeps official image URL

Deleting override:
automatic image becomes active again.

---

## DISCOVERY → IMAGE FLOW

Verify/fix:

Discovery
→ source metadata
→ JSON-LD / OG / trusted metadata
→ image candidate
→ persistence
→ validation
→ resolution/cache
→ course/media state
→ CourseCard
→ Course Detail

Do not silently drop image metadata.

If discovery result already contains a useful image URL, preserve it safely.

---

## ADMIN COURSE IMAGE

Add/complete:

Admin
→ Khóa học
→ Chỉnh sửa khóa học
→ Ảnh khóa học

Display:

* Ảnh đang sử dụng
* Nguồn ảnh
* Trạng thái
* URL nguồn when appropriate
* Kiểm tra lần cuối

Actions:

[ Tải ảnh lên ]
[ Nhập URL ảnh ]
[ Lấy lại ảnh từ nguồn ]
[ Xóa ảnh tùy chỉnh ]

---

## UPLOAD STRATEGY

M22 introduced:

* `site_assets`
* small branding images stored in Postgres bytea
* no general object storage

DO NOT automatically store large amounts of course media in `site_assets`.

Audit expected scale first.

Preferred strategy:

A. preserve automatic course media as remote validated URLs / existing pipeline

B. for manual Admin overrides:
use the smallest safe implementation consistent with existing architecture

If no object storage exists:

* do not introduce S3/Vercel Blob unless clearly necessary
* do not turn Postgres into a bulk image warehouse without documenting size risk

If storing Admin course override blobs in Postgres:

* use a dedicated bounded design
* enforce strict size limits
* do not reuse site branding keys
* document expected DB growth

Supported manual upload:

PNG
JPEG
WEBP

Validate server-side:

* MIME
* extension
* file size
* dimensions
* authorization
* safe filename/storage key

---

## REMOTE IMAGE URL

If Admin pastes an image URL:

Use existing safe image validation.

Require:

* http/https only
* no localhost
* no private/internal IP
* redirect bounds
* timeout
* response size cap
* content-type image/*
* safe final URL

Do not directly trust arbitrary remote URLs.

---

## MEDIA QUALITY ADMIN

Add/complete actionable Admin view:

Admin
→ Chất lượng Media

Filters:

* Tất cả
* Thiếu ảnh
* Ảnh lỗi
* Fallback
* Ảnh chính thức
* Ảnh metadata
* Ảnh Admin

Actions:

* Xem khóa học
* Resolve lại
* Tải ảnh
* Nhập URL
* Xóa override

If safe:

allow bounded bulk "Resolve lại".

---

## MEDIA METRICS

Expose or calculate:

course_image_coverage
official_image_rate
trusted_metadata_rate
admin_override_rate
fallback_image_rate
broken_image_rate
missing_image_rate
image_resolution_success_rate
image_refresh_failure_rate

Every metric should drill down where existing Admin conventions support it.

==================================================
GATE M23.1
==========

Verify:

* valid course without image still public
* automatic source image works
* Admin override works
* deleting override restores automatic image
* broken image uses fallback
* invalid URL rejected
* SSRF regression passes
* CourseCard layout stable
* Admin Media Quality is actionable

==================================================
M23.2 — COURSE LIFECYCLE
========================

Goal:

Provide a safe lifecycle for courses that should no longer remain in normal operation.

Do NOT implement hard delete as the normal action.

---

## LIFECYCLE SEMANTICS

Adapt to existing model.

Conceptually:

ACTIVE
↓
UNPUBLISHED
↓
ARCHIVED

ARCHIVED
↓ restore
UNPUBLISHED

ARCHIVED
↓ ADMIN purge
PERMANENTLY DELETED

Do not add duplicate statuses if equivalent already exists.

---

## UNPUBLISH

Meaning:

* temporarily unavailable publicly
* still visible in normal Admin management
* easily publishable again
* history preserved

---

## ARCHIVE

Meaning:

Course disappears from normal product operation.

Archived course must NOT appear in:

* homepage
* search
* course recommendations
* topic pages
* category pages
* Miễn phí hôm nay
* sitemap
* structured public lists
* verification scheduler
* monitor/observation scheduler
* active affiliate placement resolution

But retain historical data as appropriate:

* course row
* audit log
* verification history
* observations
* offer history
* outbound clicks
* media history
* historical analytics

Admin default list may hide archived courses.

Add filter:

"Đã lưu trữ"

Actions:

[ Khôi phục ]
[ Xóa vĩnh viễn ]

---

## RESTORE

Restore should return archived course to a safe non-public state first unless current architecture has a better invariant.

Preferred:

ARCHIVED
→ UNPUBLISHED

Then Admin explicitly publishes if desired.

Do not automatically republish stale data.

---

## PERMANENT DELETE / PURGE

ADMIN ONLY.

Never EDITOR.

UI must clearly separate destructive operation.

Example:

"Khu vực nguy hiểm"

"Xóa vĩnh viễn khóa học"

Require strong confirmation such as:

type course slug
or
type exact course title

Require deletion reason.

---

## DEPENDENCY GUARD

Before purge inspect dependencies:

* outbound clicks
* observations
* verifications
* offers/coupons
* watchers
* affiliate placements
* media
* embeddings
* search analytics
* audit history
* relations

Classify:

SAFE_TO_PURGE
PURGE_WITH_SAFE_CASCADE
BLOCKED_BY_HISTORY

Do not cascade blindly.

---

## SAFE PURGE CASES

Examples more suitable for permanent delete:

* test data
* import mistake
* duplicate never meaningfully used
* never published
* synthetic fixture created accidentally
* invalid garbage data

Examples that should default to Archive:

* course had real users/clicks
* long publication history
* historical offers
* watchers
* meaningful observation history
* analytics references

---

## DUPLICATE HANDLING

Add/complete:

"Đánh dấu trùng lặp"

Preferred behavior:

Course B
→ duplicate of Course A
→ Archive B
→ retain canonical A

Do not attempt risky automatic full history merge unless current schema makes it clearly safe.

---

## AUDIT

Audit actions:

UNPUBLISH
ARCHIVE
RESTORE
PURGE
DUPLICATE_MARK

Permanent delete should preserve a minimal tombstone/audit reference if needed so the audit log remains understandable.

Do not retain unnecessary full data merely to claim purge exists.

==================================================
GATE M23.2
==========

Tests must prove:

* archive disappears from all public surfaces
* archive disappears from schedulers
* restore works
* EDITOR cannot purge
* ADMIN purge confirmation enforced
* dependency guard enforced
* purge failure transaction rolls back
* no orphan records
* audit log correct

==================================================
M23.3 — AFFILIATE PRODUCT MODEL
===============================

Goal:

Make commerce affiliate operations understandable to an operator.

The operator should manage "Sản phẩm", not only abstract campaigns/placements.

Audit current schema first.

If an equivalent product entity exists:
reuse it.

Otherwise add the smallest conceptual entity:

affiliate_products

Fields conceptually:

id
merchant
title
destination_url
merchant_product_id nullable

image_url nullable
media reference nullable

short_description nullable

product_category

display_price nullable
original_price nullable
currency nullable
discount_label nullable

shop_name nullable

status
starts_at nullable
ends_at nullable

created_at
updated_at

Do not duplicate existing campaign/provider semantics.

---

## MERCHANTS

Support initially:

SHOPEE
LAZADA

Optional generic fallback only if current architecture already supports it cleanly.

---

## PRODUCT CATEGORIES

Reuse v1.3 allowed commerce categories:

BOOK
LAPTOP_TABLET
MONITOR
KEYBOARD_MOUSE
HEADSET_WEBCAM_MIC
LAPTOP_STAND
DESK_LIGHT
STUDY_ACCESSORY
LAB_NETWORKING_DEVICE
OTHER_LEARNING_RELATED

Do not create arbitrary unrelated commerce categories.

==================================================
M23.4 — ADMIN ADD LINK / PRODUCT WORKFLOW
=========================================

Create/complete practical Admin navigation:

Admin
→ Tiếp thị liên kết
→ Sản phẩm

List page:

* active products
* inactive products
* merchant
* placement count
* mapped context
* click count where available

Action:

[ Thêm sản phẩm ]

---

## ADD PRODUCT FORM

Required:

Tên sản phẩm *

Nền tảng *

* Shopee
* Lazada

Link sản phẩm / Affiliate link *

Danh mục sản phẩm *

Optional:

Ảnh sản phẩm
Mô tả ngắn
Tên shop
Giá hiển thị
Giá gốc
Nhãn giảm giá
Hiệu lực từ
Hiệu lực đến

Status:

ACTIVE
INACTIVE

Do not require optional commercial fields.

---

## ADD LINK FLOW

Admin pastes:

https://shopee.vn/...
or supported affiliate/deep link.

System:

1. parse
2. validate scheme
3. detect merchant
4. validate host
5. protect against open redirect
6. preserve affiliate/deep-link parameters required for attribution
7. normalize only safe irrelevant tracking when appropriate
8. save destination
9. preview

Do NOT blindly strip parameters.

Do NOT rewrite an affiliate URL into a plain merchant URL.

Do NOT fetch arbitrary marketplace HTML unless an existing safe provider policy explicitly permits it.

---

## PRODUCT IMAGE

Allow:

[ Tải ảnh lên ]
[ Nhập URL ảnh ]

Priority:

ADMIN_UPLOADED_IMAGE
→ VALIDATED_REMOTE_PRODUCT_IMAGE
→ MERCHANT/GENERIC FALLBACK

Use the same safe image validation principles as course media.

Do not hotlink arbitrary URLs without validation.

Do not scrape Google Images.

---

## CONTEXT MAPPING

Admin must map product relevance to:

* Course
* Topic
* Category
* Learning Path context if existing paths support this cleanly

Do not require raw IDs.

Use searchable selectors/autocomplete.

One product may have multiple context mappings.

Examples:

Python:

* sách Python
* keyboard
* laptop stand

Power BI/Data:

* sách SQL
* monitor
* keyboard/mouse

Networking:

* lab/networking accessory

---

## PLACEMENT

Reuse existing placement semantics:

COURSE_DETAIL_RELATED_LEARNING
TOPIC_LEARNING_RESOURCES
LEARNING_PATH_RESOURCES

Admin UI:

* Product
* Context
* Placement
* Priority
* Enabled
* Start
* End

Priority must be editorial.

Do not use commission rate for ordering.

---

## PREVIEW

Before activation Admin should see:

"Sản phẩm này sẽ xuất hiện tại:"

* Course ...
* Topic ...
* Category ...
* Learning Path ...

Add safe preview if architecture allows.

==================================================
GATE M23.4
==========

Verify:

* Shopee product can be created
* valid Shopee URL accepted
* invalid merchant URL rejected
* required affiliate parameters preserved
* image can be set
* mapping works
* no raw ID entry required
* preview works
* inactive/expired product hidden
* Admin action audited

==================================================
M23.5 — PUBLIC COMMERCE SURFACE
===============================

Goal:

Show commerce only when it is relevant.

---

## COURSE DETAIL

When a course has relevant active commerce products:

show one secondary section:

"Góc học tập"

Example:

[product image]

Sách Python cho người mới

Shopee

[Xem trên Shopee]

Liên kết tiếp thị

Rules:

* learning remains primary
* maximum one commerce section per Course Detail
* do not insert inside organic search result ranking
* product card must not look like a course card
* merchant clearly visible
* disclosure clearly visible
* no irrelevant fallback products

If no relevant product:
hide the section completely.

---

## TOPIC PAGE

If relevant product exists:

"Tài nguyên học tập hữu ích"

No product:
section hidden.

---

## LEARNING PATH

If supported:

"Tài nguyên có thể hữu ích"

Commerce section:

* is not a learning path step
* does not affect path completeness
* cannot substitute for a missing course

---

## AFFILIATE OUTBOUND

All commerce outbound through one safe boundary.

Reuse AffiliateLinkService or equivalent.

Flow:

Public CTA
→ internal outbound route
→ validate product active
→ validate campaign/placement
→ record click
→ redirect to destination

Record when architecture supports:

product_id
merchant
campaign_id nullable
placement
course_id nullable
topic_id nullable
clicked_at

Tracking failure must NOT block redirect to a valid destination.

---

## DISCLOSURE

Near the commerce CTA:

"Liên kết tiếp thị"

Do not hide disclosure only in footer.

---

## FEATURE FLAGS

Audit actual flags:

FEATURE_MONETIZATION
FEATURE_COMMERCE_AFFILIATE

Add product-specific flag only if needed:

FEATURE_AFFILIATE_PRODUCTS

Do NOT force-enable production flags.

Local/Admin preview may bypass public visibility safely.

When flags OFF:
core product remains clean and fully usable.

==================================================
GATE M23.5 — E2E SHOPEE
=======================

Create an end-to-end test:

1. Admin creates Shopee product
2. Admin enters valid Shopee affiliate URL
3. Admin sets product image
4. Admin maps product to a course
5. Admin activates product/placement
6. Public Course Detail renders "Góc học tập"
7. correct image/title/merchant render
8. "Liên kết tiếp thị" visible
9. user clicks CTA
10. click recorded
11. destination redirect correct

Negative tests:

inactive product → hidden

expired product → hidden

invalid URL → rejected

no mapping → hidden

feature OFF → hidden

tracking DB failure → redirect still succeeds

==================================================
M23.6 — ADMIN OPERATIONS & DATA QUALITY
=======================================

Improve Admin operational visibility.

---

## COURSE LIST FILTERS

Add/reuse:

Published
Unpublished
Archived
Missing Image
Broken Image
Fallback Image
Admin Image
Duplicate

---

## ACTIONABLE DASHBOARD

Add actionable items:

Course thiếu ảnh
Course ảnh lỗi
Course đang dùng fallback

Course đã lưu trữ
Course nghi trùng lặp

Affiliate sản phẩm chưa có placement
Placement không có active product
Sản phẩm sắp hết hiệu lực

Coupon verification errors

Course UI/data mismatch if detectable

Each metric must drill down to a relevant filtered list where possible.

---

## AFFILIATE DASHBOARD

Show:

Active Products
Inactive Products
Products without placement

Shopee Products
Lazada Products

Clicks today
Clicks 7 days

Top products
Top placements

Do not invent revenue if revenue data is unavailable.

==================================================
M23.7 — POST-M22 HARDENING
==========================

Audit and test all important post-redesign paths.

---

## PUBLIC SURFACES

Review:

Homepage
Search/Catalog
Course Detail
Miễn phí hôm nay
Category
Topic

Ensure they never surface:

* archived courses
* unpublished courses
* expired coupon offers
* invalid offers

---

## BRANDING / M22

M22 currently uses:

* site_settings
* site_assets
* Postgres bytea
* public site asset endpoint
* `?v=` cache busting
* runtime reads on dynamic pages
* some SSG topic/free-course pages may not immediately reflect logo changes

Audit this.

Do NOT redesign branding again.

Determine whether current static pages cause stale logo/branding.

If they do:

choose the smallest correct solution.

Possible:

* targeted revalidation
* dynamic brand component
* cache strategy adjustment

Do NOT make every page force-dynamic without measuring/need.

---

## MEDIA TEST SCENARIOS

Test:

official image
trusted metadata image
Admin override
broken image
missing image
fallback
invalid remote URL
provider timeout

---

## LIFECYCLE TEST SCENARIOS

Test:

publish
unpublish
archive
restore
purge allowed
purge blocked
duplicate mark
archive course with historical clicks

---

## AFFILIATE SECURITY SCENARIOS

Test:

valid Shopee URL
valid Lazada URL if supported
unknown domain
javascript:
data:
open redirect attempt
expired product
inactive product
feature OFF
tracking failure
bad image URL

---

## SECURITY REVIEW

Review:

* Admin RBAC
* audit log
* CSRF where relevant
* SSRF image URLs
* file uploads
* affiliate open redirect
* XSS product title/description
* SQL injection
* secret handling

==================================================
M23.8 — FULL QUALITY GATES & FINAL AUDIT
========================================

Use REAL scripts from package.json.

Do not invent commands.

Run applicable:

* format/check
* lint
* typecheck
* unit tests
* integration tests
* full test suite
* build
* migration validation
* security regression

Fix-until-pass.

Do NOT:

* delete tests
* weaken assertions
* disable lint to pass
* ignore type errors
* hard-code test fixtures into production paths
* mock away core behavior

---

## FINAL JOURNEY REVIEW

Journey A — Course Media

Discovery
→ candidate
→ image extraction
→ approve/publish
→ public card
→ detail

Journey B — Course Lifecycle

Publish
→ unpublish
→ archive
→ verify hidden everywhere
→ restore

Also test one safe purge fixture.

Journey C — Shopee

Admin
→ add product
→ affiliate link
→ image
→ mapping
→ placement
→ preview
→ public Course Detail
→ click
→ analytics
→ redirect

Journey D — M22 UI

Homepage
Catalog
Course Detail
Admin Course
Admin Media
Admin Affiliate

Desktop + mobile.

==================================================
FINAL ACCEPTANCE
================

v1.3.2 is DONE only when:

## MEDIA

* actual missing-image root cause fixed
* automatic image pipeline works where source permits
* Admin manual override works
* remote image validation works
* broken image fallback works
* media quality page actionable
* SSRF tests pass

## LIFECYCLE

* Unpublish / Archive / Restore clearly separated
* Archived course removed from all public surfaces
* Archived course removed from scheduler/monitor work
* Permanent Delete ADMIN-only
* dependency guard exists
* transaction-safe purge
* audit log correct

## AFFILIATE

* Admin can create a Shopee product
* Admin can paste an affiliate link
* product can have an image
* product can map to course/topic/category
* placement can be previewed
* product renders publicly when relevant
* disclosure visible
* click tracked
* safe redirect works
* feature OFF removes commerce cleanly
* commission never affects ranking

## POST-M22

* new UI reads real data
* no fake rating
* no fake learner count
* no fake freshness
* offer_url/coupon behavior preserved
* Vietnamese-only preserved
* branding update behavior acceptable

## SECURITY

RBAC PASS
SSRF PASS
open redirect PASS
XSS PASS
upload security PASS

## QUALITY

lint PASS
typecheck PASS
tests PASS
build PASS
migration validation PASS

## FINAL AUDIT

P0 = 0

P1 = 0
or explicitly documented ACCEPTED_RISK

==================================================
FINAL REPORT
============

Return ONE report:

# v1.3.2 / M23 FINAL REPORT

## 1. TARGETED AUDIT

* Media root causes
* Lifecycle dependency map
* Affiliate runtime matrix

## 2. COURSE MEDIA

* what was broken
* what was fixed
* automatic resolution
* Admin override
* before/after metrics if data available

## 3. COURSE LIFECYCLE

* status/actions implemented
* archive behavior
* restore behavior
* purge policy
* dependency guards

## 4. AFFILIATE / SHOPEE

* product model
* add-link workflow
* image
* mapping
* placement
* public rendering
* outbound
* analytics

## 5. POST-M22

* branding/cache findings
* UI/data wiring findings

## 6. ADMIN

* new pages
* new filters
* new operations

## 7. MIGRATIONS

* migration files
* purpose
* rollback considerations

## 8. CHANGED FILES

grouped by:

* media
* course lifecycle
* affiliate
* admin
* public UI
* tests

## 9. SECURITY

* SSRF
* open redirect
* upload
* XSS
* RBAC
* audit

## 10. QUALITY GATES

Exact command
→ PASS / FAIL

## 11. E2E JOURNEYS

Course Media
Course Lifecycle
Shopee Affiliate
Post-M22 UI

## 12. FINDINGS

P0
P1
P2

## 13. BLOCKED / ASSUMPTIONS

## 14. MANUAL REVIEW NEEDED

Keep this concise.

## 15. NOT DONE

List anything intentionally deferred.

DO NOT COMMIT.
DO NOT PUSH.
DO NOT DEPLOY.

STOP after the final report.
