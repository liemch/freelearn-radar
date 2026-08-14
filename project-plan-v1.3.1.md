# FreeLearn Radar — v1.3.1 / M21

## Coupon Discovery, Multi-Domain Coverage, Course Media & Discovery UX

> v1.3.1 là release kế tiếp sau v1.3/M20.
> Không sửa hoặc hợp thức hóa v1.3 bằng tài liệu này.
> M21 chỉ bắt đầu sau khi Cursor hoàn thành implementation v1.3 hiện tại.
>
> Execution mode của v1.3.1 được thiết kế cho **overnight implementation**:
> Cursor được phép triển khai liên tục M21.0 → M21.12, không chờ user confirm giữa
> các milestone. Không có STOP gate giữa chặng. Full test/build/audit/review được
> chạy ở cuối; tuy nhiên các migration, type contract và invariant nguy hiểm vẫn
> phải được kiểm tra cục bộ ngay khi thay đổi để tránh lỗi dây chuyền.
>
> Mặc định trong overnight run:
> **KHÔNG commit, KHÔNG push, KHÔNG deploy production.**

---

# 118. Baseline kế thừa từ v1.3

v1.3 đã định vị FreeLearn Radar từ hệ thống chỉ biết khóa nào đang free sang hệ
thống tìm đúng khóa học phù hợp với mục tiêu người dùng. v1.3.1 không thay trục
Truth/Search/Relevance đó.

M21 giải quyết bốn finding mới:

```text
1. DISCOVERY GAP
   Radar có thể không phát hiện được paid Udemy course đang có coupon 100%.

2. DOMAIN BIAS
   Discovery hiện dễ nghiêng quá mạnh về Tech/AI/Programming.

3. MEDIA GAP
   Radar phát hiện course nhưng thumbnail/course image có thể thiếu hoặc hỏng.

4. DISCOVERY UX GAP
   Public UX chưa tận dụng tốt urgency của deal hôm nay, category/topic browsing,
   freshness và verified status.
```

North Star tiếp tục kế thừa v1.3:

```text
Outbound Course Clicks
```

Supporting metrics M21:

```text
verified coupon discovery rate
coupon validation rate
coupon freshness
category coverage balance
course image coverage
broken image rate
daily-free outbound CTR
topic/category outbound CTR
```

---

# 119. Product Direction v1.3.1

## 119.1 Định vị

```text
"Radar giúp người Việt tìm những thứ đáng học miễn phí mỗi ngày —
từ công nghệ, công việc, kỹ năng mềm đến phát triển bản thân —
và nói rõ miễn phí theo cách nào, còn hiệu lực hay không."
```

Không định vị FreeLearn Radar là website khóa học IT.

## 119.2 Vietnamese-only UI

Kế thừa quyết định M20.14:

```text
Public UI     = Tiếng Việt
Admin UI      = Tiếng Việt
UI locales    = vi only
```

Nhưng catalog vẫn quốc tế.

```text
Vietnamese query
→ English/international course
```

Official title/provider name không bị dịch sai.

## 119.3 Không thêm hai feature sau

```text
KHÔNG "Gửi link để Radar kiểm tra" / Add Course
KHÔNG Instructor Promote / Sponsored placement
```

Lý do:

```text
community submission → spam/moderation/duplicate/abuse surface chưa cần thiết
sponsored placement  → quá sớm và dễ làm mờ trust/ranking invariant
```

---

# 120. Hard Invariants M21

```text
Truth > Discovery.
Discovery source KHÔNG phải Truth source.

Aggregator nói "100% free"
→ chỉ là candidate signal.

Udemy/official evidence xác minh không đủ
→ không publish claim 100% free.

Chỉ 100% OFF mới được gắn "Coupon 100%".

canonical_url ≠ offer_url.

Không strip couponCode trước khi offer được parse/lưu.

Coupon expired/invalid
→ không tiếp tục hiển thị như active free deal.

FREE_PREVIEW ≠ FREE_FULL.
FREE_TRIAL ≠ FREE_FULL.
FREE_AUDIT ≠ FREE_FULL.

Thumbnail không phải Truth.
Thiếu ảnh không được làm course biến mất.

Không hotlink/search ảnh tùy tiện từ Google Images.

Không dùng AI-generated image giả làm official course thumbnail.

Không để Tech chiếm catalog chỉ vì discovery query hiện tại thiên Tech.

Affiliate/monetization không tác động Truth hoặc organic ranking.

Không bypass bot protection / CAPTCHA / access control.

Provider Policy của v1.3 vẫn là luật.

Không full-site crawling vô hạn.

Không copy description/editorial content của coupon aggregator.

External HTML/text luôn là untrusted input.
```

---

# 121. Target Architecture

```text
                    DISCOVERY SOURCES
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
 Provider discovery   Coupon sources     Search/discovery
        │                 │                  │
        └─────────────────┼──────────────────┘
                          ▼
                    Candidate Layer
                          │
                  normalize identity
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
   Course Resolver   Offer Resolver   Media Resolver
          │               │                │
          ▼               ▼                ▼
      Truth Engine   Coupon Verify     Image Validate
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                    Published Catalog
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
  Miễn phí hôm nay    Topic/Category    Search/Finder
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                      Outbound
```

---

# 122. M21.0 — v1.3 Runtime Audit & M21 Baseline

## 122.1 Mục tiêu

Audit code sau khi v1.3 implementation hoàn tất, nhưng **không dừng overnight run
chỉ để chờ user review**.

Audit trả lời:

```text
1. schema/course/provider hiện tại có field nào dùng được cho coupon?
2. URL normalization hiện tại có strip query params không?
3. couponCode có bị mất ở ingestion/discovery không?
4. provider policy của Udemy hiện cho phép fetch/resolve mức nào?
5. current discovery sources là gì?
6. category/topic taxonomy hiện tại có bao nhiêu domain?
7. distribution published course theo category/provider?
8. thumbnail hiện lấy từ đâu?
9. tỷ lệ course có ảnh hợp lệ?
10. broken/fallback image rate?
11. current public homepage/category/topic/card components nằm ở đâu?
12. current admin quality/discovery surfaces nằm ở đâu?
13. v1.3 search/Truth/ranking service nào phải reuse?
14. v1.3 Vietnamese-only migration đã wired thực tế chưa?
```

## 122.2 Known-positive coupon fixture

Đưa vào fixture/test dataset một cấu trúc tương đương:

```text
provider       = UDEMY
canonical_url  = https://www.udemy.com/course/<slug>/
offer_url      = https://www.udemy.com/course/<slug>/?couponCode=<CODE>
coupon_code    = <CODE>
expected       = resolver KHÔNG được làm mất coupon_code
```

Coupon thực tế có thể hết hạn nên test logic không phụ thuộc việc coupon lịch sử
còn sống trên Internet.

## 122.3 Baseline report

```text
published courses
provider distribution
category distribution
top-level domain distribution
course_image_coverage
broken_image_rate
fallback_image_rate
Udemy course count
Udemy active coupon count hiện tại
coupon discovery sources hiện tại
discovery candidates/day
verified candidates/day
```

---

# 123. M21.1 — Multi-Domain Taxonomy Expansion

## 123.1 Mục tiêu

FreeLearn Radar phải phục vụ nhu cầu học rộng, không chỉ Tech.

Top-level taxonomy đề xuất:

```text
Công nghệ & IT
Kinh doanh & Quản lý
Tài chính
Kỹ năng mềm
Phát triển bản thân
Cuộc sống & Sức khỏe
Thiết kế & Sáng tạo
Ngoại ngữ
Văn phòng & Công việc
Giáo dục
Khoa học & Kỹ thuật
Xã hội & Nhân văn
Nghề nghiệp
```

Phải audit taxonomy v1.3 trước khi tạo mới. Reuse/rename/map khi có equivalent,
không tạo duplicate chỉ vì wording khác.

## 123.2 Hai tầng, không tạo cây category khổng lồ

```text
Category chính
   ↓
Topic / Skill tags
```

Ví dụ:

```text
Phát triển bản thân
  → Kỷ luật bản thân
  → Quản lý thời gian
  → Năng suất
  → Xây dựng thói quen

Kỹ năng mềm
  → Giao tiếp
  → Thuyết trình
  → Đàm phán
  → Tư duy phản biện
  → Giải quyết vấn đề
  → Làm việc nhóm
```

Một course:

```text
primary_category = 1
topic_tags       = many
```

## 123.3 Mapping

Mapping ưu tiên deterministic:

```text
provider taxonomy
title/description metadata
existing topic tags
known alias dictionary
```

AI chỉ hỗ trợ classification khi deterministic không đủ và phải validate vào
taxonomy thật.

Không để AI tự tạo category mới.

---

# 124. M21.2 — Balanced Multi-Domain Discovery

## 124.1 Vấn đề

Nếu discovery chỉ chạy theo query phổ biến hoặc seed hiện tại, catalog có thể tự
biến thành:

```text
AI
Python
Cloud
Data
...
```

dù taxonomy trông đa dạng.

## 124.2 Discovery coverage budget

Mỗi top-level category có discovery budget/seed riêng.

Không bắt buộc tỷ lệ course bằng nhau. Mục tiêu là tránh category quan trọng bị
starvation.

Lưu:

```text
category
queries_run
candidates_found
verified_count
published_count
zero_candidate_runs
last_discovered_at
```

Admin phải nhìn được category nào đang thiếu coverage.

## 124.3 Seed query library

Tạo seed VI + EN theo domain.

Ví dụ:

```text
"Kỹ năng giao tiếp miễn phí"
"communication skills free course"

"quản lý thời gian"
"time management free course"

"Excel cho người mới"
"Excel beginner free course"

"tiếng Anh giao tiếp"
"English speaking free course"
```

Search query là discovery hint, không phải evidence để publish.

---

# 125. M21.3 — Udemy 100% Coupon Discovery Engine

## 125.1 Mục tiêu

Tìm paid Udemy courses đang có **coupon giảm 100%** trong thời gian giới hạn.

Đây là pipeline riêng với permanently-free discovery.

## 125.2 Coupon Source Registry

Conceptual:

```text
coupon_sources
  id
  name
  source_type
  base_url
  enabled
  priority
  discovery_only = true
  last_run_at
  last_success_at
  health_status
```

Seed đầu tiên có thể bao gồm source coupon đã được operator xác nhận, ví dụ
Real.Discount, **chỉ khi Provider/Source Policy cho phép cách truy cập dự kiến**.

Không hard-code một aggregator thành dependency bắt buộc.

## 125.3 Discovery-only rule

```text
Coupon aggregator
      ↓
candidate
      ↓
extract course identity + coupon
      ↓
official/provider verification
      ↓
publish
```

Không publish trực tiếp từ claim của aggregator.

## 125.4 Candidate fields

```text
provider
canonical_url
offer_url
coupon_code
discovered_from
discovered_at
source_claim
source_price
source_original_price
source_expires_at
status
```

## 125.5 URL invariant

Ví dụ:

```text
canonical_url
https://www.udemy.com/course/example/

offer_url
https://www.udemy.com/course/example/?couponCode=ABC123

coupon_code
ABC123
```

Normalization phải giữ course identity và offer identity riêng.

`rand`, tracking params, affiliate params có thể bỏ nếu không cần; `couponCode`
không được bỏ trước khi parse.

---

# 126. M21.4 — Coupon Verification, Expiry & Re-verification

## 126.1 State machine

```text
DISCOVERED
   ↓
VERIFYING
   ├── ACTIVE_100_OFF
   ├── ACTIVE_DISCOUNTED
   ├── EXPIRED
   ├── INVALID
   ├── BLOCKED
   └── UNKNOWN
```

Chỉ:

```text
ACTIVE_100_OFF
```

được surface dưới label **Coupon 100%**.

## 126.2 Verification

Verification phải tuân Provider Policy.

Nếu official provider không thể được xác minh hợp lệ:

```text
UNKNOWN / BLOCKED
```

không tự suy luận từ aggregator thành verified.

## 126.3 Re-verification

Coupon là volatile offer.

Recheck schedule phải bounded và ưu tiên theo:

```text
freshly discovered active coupons
near-expiry coupons
high outbound traffic coupons
stale active coupons
```

Không hammer provider.

Backoff + concurrency + rate limit bắt buộc.

## 126.4 Expiry UX

Khi hết:

```text
không còn ở "Miễn phí hôm nay"
không còn badge "Coupon 100%"
historical observation vẫn giữ
course canonical vẫn có thể tồn tại nếu catalog còn cần
```

---

# 127. M21.5 — Coursera Access Classification

## 127.1 Tách access khỏi certificate

Không dùng một boolean `free`.

Course access:

```text
FREE_FULL
FREE_AUDIT
FREE_PREVIEW
FREE_TRIAL
PAID
UNKNOWN
```

Certificate:

```text
FREE_CERTIFICATE
PAID_CERTIFICATE
NO_CERTIFICATE
UNKNOWN
```

Free durability tiếp tục là dimension riêng nếu schema hiện tại đã có.

## 127.2 UI wording

Ví dụ:

```text
FREE_FULL
→ "Học toàn bộ miễn phí"

FREE_AUDIT
→ "Có thể học miễn phí; một số bài đánh giá/chứng chỉ có thể trả phí"

FREE_PREVIEW
→ "Xem trước miễn phí"

FREE_TRIAL
→ "Dùng thử miễn phí"

PAID_CERTIFICATE
→ "Chứng chỉ trả phí"
```

Không hiển thị `FREE_PREVIEW` như một khóa "miễn phí 100%".

## 127.3 Migration safety

Audit enum/schema hiện tại trước. Nếu v1.3 đã có equivalent, map vào model hiện
tại thay vì tạo taxonomy trạng thái thứ hai.

---

# 128. M21.6 — Course Media & Thumbnail Pipeline

## 128.1 Mục tiêu

Course card phải có visual tốt và ổn định, nhưng ảnh không được làm ảnh hưởng
Truth eligibility.

Priority:

```text
1. official provider/course metadata image
2. trusted source metadata image đã validate
3. cached/proxied copy nếu kiến trúc hiện tại cho phép và hợp lệ
4. branded category/provider fallback
```

Không dùng:

```text
Google Images scraping
random third-party image
AI-generated image giả official thumbnail
```

## 128.2 Image model

Adapt schema thực tế; conceptual fields:

```text
image_source_url
image_resolved_url
image_source_type
image_status
image_width
image_height
image_checked_at
image_hash
fallback_reason
```

Không tạo duplicate nếu course table/media table hiện đã có equivalent.

## 128.3 Validator

Kiểm:

```text
URL parse
allowed protocol
host policy
content-type image/*
reasonable size
reasonable dimensions
timeout
redirect bounds
broken/404
```

Không biến image fetcher thành SSRF surface.

## 128.4 Fallback

Fallback phải đẹp theo category/provider, không chỉ gray box.

Ví dụ:

```text
Udemy + Phát triển bản thân
Microsoft Learn + Cloud
Coursera + Kinh doanh
```

Không giả rằng fallback là thumbnail thật.

## 128.5 Quality metrics

```text
course_image_coverage
official_image_rate
broken_image_rate
fallback_image_rate
image_resolution_success_rate
image_refresh_failures
```

Admin có filter xem course thiếu/broken/fallback image.

---

# 129. M21.7 — "Miễn phí hôm nay" Experience

## 129.1 Route

Tên route phải theo convention hiện tại, ví dụ:

```text
/mien-phi-hom-nay
```

Không tạo duplicate route nếu v1.3 đã có equivalent.

## 129.2 Nội dung

Ưu tiên:

```text
Udemy ACTIVE_100_OFF
other verified limited-time 100% offers nếu model hỗ trợ đúng
```

Không trộn FREE_PREVIEW vào section này.

Card thể hiện tối thiểu:

```text
course image
provider
title
primary category
"Coupon 100%" / loại free chính xác
verification freshness
CTA rõ
```

CTA coupon:

```text
"Nhận khóa học miễn phí"
```

Không dùng wording gây hiểu nhầm nếu offer chưa verified.

## 129.3 Freshness

Có thể hiển thị:

```text
"Xác minh 12 phút trước"
```

dựa trên timestamp thật.

Không hard-code fake freshness.

## 129.4 Daily grouping

Có thể nhóm theo category:

```text
Kỹ năng mềm
Phát triển bản thân
Kinh doanh
Công nghệ
Văn phòng
...
```

Data chính là content. Không cần AI viết daily article dài.

---

# 130. M21.8 — Interests & Discovery Personalization Lite

## 130.1 "Chủ đề tôi quan tâm"

Không bắt buộc account.

Cho user chọn một số category/topic:

```text
Kỹ năng mềm
AI
Tiếng Anh
Phát triển bản thân
Tài chính
Excel
...
```

Persist local preference nếu phù hợp architecture hiện tại.

## 130.2 Privacy

Không suy luận sensitive profile.

Không biến search history thành behavioral profile bền.

Preference do user chủ động chọn.

## 130.3 Ranking

Interest chỉ được dùng để:

```text
personalized discovery section
optional soft ordering trong "Dành cho bạn"
```

Không override Truth.

Không làm organic search trở thành opaque personalized ranking trong M21.

---

# 131. M21.9 — Topic, Category & SEO Discovery Pages

## 131.1 Category browsing

Public discovery cần entry point rộng:

```text
Danh mục
Chủ đề
Nền tảng (nếu surface hiện tại phù hợp)
```

## 131.2 SEO topic pages

Ví dụ:

```text
Khóa học Python miễn phí
Khóa học AI miễn phí cho người mới
Khóa học giao tiếp miễn phí
Khóa học Excel miễn phí
Khóa học quản lý dự án miễn phí
```

Nhưng page chỉ index khi đủ dữ liệu thật.

Không tạo hàng nghìn thin pages.

## 131.3 Data-driven value

Topic page có thể hiện:

```text
số course đang eligible
số course free bền
số active 100%-coupon
certificate availability
last verified/freshness distribution
```

Không viết fake editorial copy để SEO.

Vietnamese canonical only theo M20.14.

---

# 132. M21.10 — Discovery UI/UX Refresh

## 132.1 Inspiration, không clone

Tham khảo các pattern tốt của coupon/course discovery sites như:

```text
visual course cards
clear category browsing
daily free/deal section
strong CTA
freshness/urgency
topic navigation
```

Không copy:

```text
branding
layout pixel-for-pixel
copywriting
assets
CSS
proprietary content
```

## 132.2 Header đề xuất

```text
Khóa học
Miễn phí hôm nay
Chủ đề
Danh mục
Lộ trình
```

Adapt theo navigation v1.3 thật; tránh nhồi menu.

## 132.3 Homepage information architecture

```text
HERO
"Hôm nay bạn muốn học gì?"
[ search ]

QUICK DOMAINS
Kỹ năng mềm | Công nghệ | Kinh doanh | Ngoại ngữ
Phát triển bản thân | Văn phòng | Tài chính | Cuộc sống

🔥 MIỄN PHÍ HÔM NAY
coupon/limited offer verified

♾️ MIỄN PHÍ LÂU DÀI
durable free catalog

✨ MỚI XÁC MINH
freshly verified courses

🎯 DÀNH CHO BẠN
user-selected interests

📚 KHÁM PHÁ THEO CHỦ ĐỀ
multi-domain taxonomy
```

Không bắt buộc tất cả section nếu data không đủ. Empty section phải ẩn hoặc có
empty state hợp lý.

## 132.4 Card hierarchy

Course card ưu tiên:

```text
IMAGE
provider + free type
title
category/topic
verification freshness
CTA
```

Không nhồi badge.

Kế thừa card badge limit của v1.3.

## 132.5 Visual distinction

Phân biệt rõ:

```text
🔥 Coupon 100%
♾️ Miễn phí lâu dài
👁 Xem trước miễn phí
⏳ Dùng thử miễn phí
```

Không dựa chỉ vào màu; text/icon/label phải đủ rõ.

## 132.6 Responsive

```text
mobile-first
no horizontal overflow
touch target đủ lớn
course image không layout shift lớn
skeleton/fallback hợp lý
```

---

# 133. M21.11 — Admin, Analytics & Quality Operations

## 133.1 Admin surfaces

Reuse admin shell v1.3.

Cần nhìn được:

```text
Coupon Sources
Coupon Candidates
Active 100% Coupons
Expired / Invalid / Unknown
Coupon verification failures

Category Coverage
Discovery Runs
Zero-candidate categories

Course Media Quality
Missing Images
Broken Images
Fallback Images

Coursera Access Classification
Unknown Access
```

Nếu entity mới được tạo, admin surface phải có trong cùng release.

## 133.2 Coupon source quality

Metrics theo source:

```text
candidates_discovered
verification_success_rate
active_100_off_rate
expired_at_discovery_rate
duplicate_rate
quality_accept_rate
last_success_at
```

Source chất lượng kém có thể giảm priority/disable.

Không auto-trust source vì historical success cao.

## 133.3 Catalog balance

Dashboard:

```text
published courses/category
new verified courses/category/7d
candidate → publish conversion/category
category starvation
provider concentration
```

Không đặt quota cứng ép publish course kém chỉ để đẹp biểu đồ.

## 133.4 Media quality

```text
Course có thumbnail
Official image
Fallback image
Broken image
Missing image
```

Mỗi metric phải drill-down được vào danh sách tương ứng nếu admin architecture
hiện tại hỗ trợ pattern này.

---

# 134. M21.12 — Production Hardening & Release Readiness

## 134.1 Reliability scenarios

Test:

```text
coupon source unavailable
coupon source HTML changed
coupon parser returns malformed URL
coupon code missing
official verification blocked
coupon expires between discovery and click
duplicate coupon from multiple sources
same course has multiple coupon codes
image host unavailable
image URL 404
image content-type invalid
image redirect loop
Coursera access UNKNOWN
category classifier unknown
discovery source returns junk
all coupon sources OFF
all image resolving OFF
```

Core catalog/search phải vẫn usable.

## 134.2 Security

Audit:

```text
SSRF — image resolver
SSRF — discovery fetch
open redirect — offer/outbound URL
XSS — external course/coupon metadata
SQL injection
admin RBAC
source config mutation audit
coupon URL validation
unsafe redirect params
secret handling
rate limiting
external HTML as untrusted input
```

## 134.3 Cost guards

```text
bounded source pages/run
bounded candidates/run
bounded verification concurrency
bounded image resolution concurrency
retry cap
backoff
per-provider request budget
global daily discovery budget
kill switch
```

## 134.4 Feature flags

Adapt naming convention hiện tại:

```text
FEATURE_COUPON_DISCOVERY
FEATURE_COUPON_PUBLIC_SURFACE
FEATURE_MEDIA_RESOLVER
FEATURE_INTERESTS
FEATURE_DISCOVERY_UX
```

Flags mặc định OFF nếu repo hiện đang áp dụng invariant deploy-OFF.

Taxonomy/schema migration không được phụ thuộc flag để đảm bảo data integrity.

---

# 135. Data Model — Conceptual Additions

> Tên bảng/field phải adapt theo schema thực tế. Không tạo duplicate entity.

Conceptual:

```text
coupon_sources
coupon_candidates
course_offers
course_media
discovery_category_stats
```

`course_offers` nên cho phép:

```text
course_id
provider
canonical_url
offer_url
coupon_code
offer_type
discount_percent
price_after_discount
currency
status
discovered_from
discovered_at
verified_at
expires_at
last_error
```

Không ép mọi provider vào coupon semantics. `coupon_code` nullable.

Historical offer observation không bị overwrite mất dấu nếu architecture hiện tại
đã có append-only observation model phù hợp; ưu tiên reuse.

---

# 136. Service Boundaries

Conceptual:

```text
CouponSourceRegistry
CouponDiscoveryService
CouponCandidateParser
CourseIdentityResolver
CourseOfferResolver
CouponVerificationService
CouponReverificationScheduler
CourseMediaResolver
CourseImageValidator
CategoryCoveragePlanner
CourseTaxonomyClassifier
CourseAccessClassifier
DailyFreeQueryService
InterestPreferenceService
DiscoveryQualityService
```

Reuse:

```text
Truth Engine
Provider Policy
Source Fetching
Audit Log
RBAC
Queue/monitor
Search/Ranking
Outbound tracking
Vietnamese UI shell
```

Không tạo framework generic khổng lồ.

---

# 137. Testing Strategy — Overnight Mode

## 137.1 Không full-suite sau từng milestone

Trong M21 overnight execution:

```text
KHÔNG bắt buộc:
npm run lint
npm run typecheck
npm run test
npm run build
sau MỖI milestone
```

Thay vào đó Cursor được phép chạy liên tục M21.0 → M21.12.

## 137.2 Nhưng không được "code mù" đến cuối

Sau thay đổi có blast radius cao, chạy check nhỏ phù hợp:

```text
migration/schema
→ validate migration/schema/type generation

URL/coupon parser
→ targeted unit tests

Truth/access enum
→ targeted invariant tests

image resolver/SSRF boundary
→ targeted security/unit tests

shared types/API contracts
→ targeted typecheck package/module nếu repo hỗ trợ
```

Mục tiêu là không để một lỗi schema ở M21.3 làm hỏng 9 milestone sau.

## 137.3 Full quality gates chỉ chạy ở cuối

Sau khi M21.0 → M21.12 implementation complete:

```text
1. format/check nếu repo có
2. lint
3. typecheck
4. unit tests
5. integration tests
6. full test suite
7. build
8. migration validation
9. security regression
10. benchmark/evaluation
```

Dùng đúng scripts thực tế trong `package.json`; không bịa command.

## 137.4 Fix-until-pass loop

```text
FULL GATE
   ↓
FAIL
   ↓
classify root cause
   ↓
fix smallest correct scope
   ↓
rerun affected targeted tests
   ↓
rerun FULL GATE
   ↓
PASS
```

Không bỏ test, không comment assertion, không đổi expected value chỉ để xanh.

---

# 138. Final Audit / Review — Chỉ sau full implementation

Sau khi full quality gate PASS, Cursor thực hiện một vòng review độc lập.

## 138.1 Plan → Code matrix

Review toàn bộ:

```text
M21.0  implemented?
M21.1  implemented?
...
M21.12 implemented?
```

Mỗi claim phải map được tới:

```text
code
schema/migration
test
runtime wiring
admin/public surface nếu cần
```

## 138.2 Critical invariant review

Bắt buộc chứng minh:

```text
couponCode không bị normalization làm mất
aggregator không thể tự publish "100% free"
expired coupon không còn active
FREE_PREVIEW không render như FREE_FULL
course thiếu ảnh vẫn render
image resolver không tạo obvious SSRF
Tech không phải category duy nhất có discovery seed
Vietnamese UI vẫn là single public UI language
English course title vẫn được giữ nguyên
affiliate/ranking invariant không bị đổi
Truth filter vẫn đứng trước public eligibility
```

## 138.3 UI review

Review:

```text
homepage
search result
course detail
Miễn phí hôm nay
category page
topic page
mobile
admin coupon
admin coverage
admin media quality
```

Check:

```text
visual hierarchy
spacing
thumbnail consistency
fallback image
badge overload
Vietnamese copy
responsive
empty/loading/error states
```

Không redesign ngoài M21 scope chỉ vì reviewer "thích đẹp hơn".

---

# 139. Final Acceptance Gate v1.3.1

Release candidate chỉ được coi là DONE khi:

```text
M21.0 → M21.12 implementation complete

Coupon:
  canonical_url / offer_url / coupon_code tách đúng
  known-positive parser fixtures PASS
  only verified 100% offer → Coupon 100%
  expiry/reverification wired
  source metrics tồn tại

Domain:
  multi-domain taxonomy wired
  discovery seed/budget không chỉ Tech
  category coverage observable

Coursera/access:
  FREE_FULL / FREE_AUDIT / FREE_PREVIEW / FREE_TRIAL / PAID không bị conflated
  certificate dimension tách đúng hoặc map đúng equivalent schema

Media:
  official image path/resolver wired
  fallback wired
  broken image không phá card
  media quality metrics/admin filter có

UX:
  Miễn phí hôm nay có
  category/topic discovery có
  Vietnamese-only UI giữ nguyên
  coupon/free type visual rõ
  mobile usable

Admin:
  coupon operations observable
  coverage observable
  media quality observable

Security:
  SSRF/open redirect/XSS regression PASS
  admin RBAC PASS
  provider policy không bị bypass

Quality:
  lint PASS
  typecheck PASS
  test PASS
  build PASS
  migration validation PASS

Final Audit:
  P0 = 0
  P1 = 0
  hoặc P1 có ACCEPTED_RISK rõ ràng
```

Không deploy production tự động.

---

# 140. Overnight Cursor Execution Protocol

## 140.1 Mục tiêu

Cho phép chạy một mạch trong lúc user không có mặt.

```text
READ PLAN + REPO
      ↓
M21.0 AUDIT/BASELINE
      ↓
M21.1
      ↓
M21.2
      ↓
M21.3
      ↓
M21.4
      ↓
M21.5
      ↓
M21.6
      ↓
M21.7
      ↓
M21.8
      ↓
M21.9
      ↓
M21.10
      ↓
M21.11
      ↓
M21.12
      ↓
FULL QUALITY GATES
      ↓
FIX UNTIL PASS
      ↓
FINAL PLAN→CODE AUDIT
      ↓
FINAL REVIEW
      ↓
FINAL REPORT
      ↓
STOP
```

## 140.2 Không chờ confirmation

Cursor không dừng để hỏi user giữa milestone khi có thể giải quyết an toàn từ:

```text
project plan
existing architecture
existing naming convention
tests
schema
provider policy
```

Nếu có ambiguity không nguy hiểm:

```text
chọn phương án conservative nhất
ghi assumption vào final report
tiếp tục
```

Nếu gặp quyết định có thể:

```text
xóa dữ liệu production
bypass security
thay provider policy
làm destructive migration không rollback được
yêu cầu secret/API credential chưa có
phá invariant Truth
```

thì **không tự đoán**. Implement phần độc lập còn lại, ghi BLOCKED item và tiếp
tục nơi có thể.

## 140.3 Không commit/push/deploy

Trong overnight run:

```text
DO NOT git commit
DO NOT git push
DO NOT deploy
DO NOT create production data mutation
```

Trừ khi user đưa instruction mới ghi đè rõ ràng.

## 140.4 Không cheat quality gate

Cấm:

```text
skip tests để PASS
disable lint rule tùy tiện
delete failing test vì khó sửa
weaken assertion để xanh
mock away core behavior
hard-code fixture vào production path
mark TODO rồi coi milestone DONE
fake verification timestamp
fake coupon success
fake image success
```

## 140.5 Final report

Sáng hôm sau phải có:

```text
IMPLEMENTED
  milestone-by-milestone

CHANGED FILES
  grouped by domain

MIGRATIONS
  what/why/rollback note

QUALITY GATES
  command + PASS/FAIL

AUDIT FINDINGS
  P0/P1/P2

BLOCKED / ASSUMPTIONS
  explicit

COUPON RESULTS
  parser/verification/source metrics available locally

MEDIA RESULTS
  coverage/broken/fallback baseline vs after if data available

DOMAIN COVERAGE
  category distribution

MANUAL REVIEW NEEDED
  concise list

NOT DONE
  anything intentionally deferred
```

---

# 141. Scope Lock

v1.3.1 DONE không có nghĩa tiếp tục tự mở v1.4.

Ngoài scope:

```text
community reviews
social feed
public comments
Add Course submission
Instructor Promote
Sponsored ranking
paid subscription
LMS progress tracking
gamification
native mobile app
browser extension
universal coupon engine cho mọi website
AI-generated course
full web crawler
```

Sau Final Report: **STOP và chờ user review.**
