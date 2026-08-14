# FreeLearn Radar — **v1.2 / M19**

## Coverage, Truth & Time Intelligence

> Append-only addendum cho `project-plan.md`.
> Chiếm slot `M19` đang **deferred**. Không đổi số WP0–WP14, M15–M17, WP18.
> Section mới bắt đầu từ **65**. Các amendment cho section cũ nằm ở **§65.9**.

---

# 65. Định vị v1.2

## 65.1 Vì sao không phải "WP19 tiếp theo"

WP0–WP14 + M15–M17 + WP18 đã xây xong một **directory tốt**: discovery, verify, review, publish, hub SEO, bilingual EN/VI, source fetching SSRF-safe.

Directory nào cũng copy được trong 2 tháng. Thứ không copy được là **dữ liệu theo thời gian** — và sau M16 + M18.4, khoảng 90% hạ tầng cho việc đó đã nằm trong repo:

```text
course_verifications    lịch sử verify + evidence
CourseSourceFetcher     fetch bounded, SSRF-safe, provider policy
evidence model          free signal + certificate signal
recheck priority        biết course nào cần kiểm lại
/api/cron/verify        vòng lặp định kỳ
```

Đang phục vụ mục đích: xác minh **một lần** trước publish.
v1.2 chuyển nó thành: quan sát **liên tục** sau publish.

## 65.2 Định vị mới

```text
v1.1   "Danh sách khóa học miễn phí"
          ↓
v1.2   "Nơi biết chính xác khóa nào ĐANG miễn phí,
        miễn phí từ khi nào, có chứng chỉ thật không,
        và dữ liệu được kiểm lần cuối lúc nào"
```

Bốn trục của v1.2, theo thứ tự triển khai:

```text
CONTROL    admin đủ sức vận hành mọi thứ bên dưới  (nút thắt → làm trước)
TRUTH      nói đúng về free + certificate          (rẻ nhất, sửa được ngay)
COVERAGE   mở rộng provider + độ sâu chủ đề        (giải thin content của M17)
TIME       quan sát liên tục + alert               (moat, nặng nhất)
```

Cố tình xếp TRUTH trước TIME: nếu thông tin certificate còn sai thì tracker chỉ theo dõi chính xác một thứ sai.

Cố tình xếp CONTROL trước tất cả: xem `§79`.

---

# 65.3 Non-Goals v1.2

```text
KHÔNG public user account       (vẫn chỉ email + cookie)
KHÔNG paid tier / subscription
KHÔNG vector DB / semantic search        → v1.3
KHÔNG newsletter tổng hợp                (chỉ transactional alert)
KHÔNG redesign UI                        (M18.2 vừa xong)
KHÔNG dark mode / animation / dashboard hóa public site
KHÔNG crawl toàn catalog provider
KHÔNG bypass bot protection / headless browser để vượt chặn
KHÔNG coupon aggregator làm nguồn discovery      ← xem §65.4
KHÔNG thêm top-level category                    ← xem §67
```

Ràng buộc cứng: **provider fetch policy của M18.4 là luật.**

```text
FETCH_ALLOWED   observe đầy đủ
METADATA_ONLY   observe giới hạn
NO_FETCH        chỉ tín hiệu SEARCH hoặc MANUAL, không vẽ chart giá
```

---

# 65.4 Quyết định: từ bỏ coupon 100% off của Udemy

Tháng 2/2026 Udemy siết coupon free dạng mở từ **1.000 → 10 lượt redemption**, và giới hạn 3 coupon/khóa/tháng.

Evidence:

```text
https://teach.udemy.com/update-for-instructors-improving-free-coupons-better-targeting-higher-quality-learning/
```

Hệ quả thực tế: coupon công khai cháy trong vài giây; các site tổng hợp coupon hiện đầy code đã hết hạn. Muốn cạnh tranh phải verify real-time + browser extension — cuộc đua hạ tầng mà FreeLearn Radar không tham gia.

Quyết định:

```text
KHÔNG lưu coupon_code
KHÔNG tracking coupon expiry
KHÔNG lấy coupon aggregator làm nguồn
FREE_WITH_COUPON  giữ trong enum nhưng chỉ đặt được bằng MANUAL
```

Đổi hướng ngân sách quan sát sang nhóm provider **free bền** (§68) — vốn cũng chính là nhóm `FETCH_ALLOWED`. Tức là bỏ coupon làm tracker **mạnh hơn**, không phải yếu đi.

---

# 66. TRUTH — Pricing & Certificate Rules

## 66.1 Vấn đề hiện tại

`§13` cấm suy luận certificate khi thiếu evidence — luật đúng, nhưng hệ quả là gần như toàn bộ course Udemy rơi vào `UNKNOWN`, đúng lúc đây là thông tin người học quan tâm nhất.

## 66.2 Provider Certificate Policy — deterministic, không phải AI

Chính sách công bố của provider **chính là evidence**. Đọc policy một lần, ghi thành rule, gắn `evidence_url` trỏ về trang policy đó.

Bảng mới:

```text
provider_policies

id
provider_id
price_type              ← rule áp dụng cho price_type nào
certificate_type        ← kết luận
evidence_url            ← trang policy của provider
policy_note
effective_from
reviewed_at
reviewed_by
active
```

Seed ban đầu (Udemy — đã verify 2026-08):

```text
Udemy + FREE_FULL         → NO_CERTIFICATE
Udemy + FREE_WITH_COUPON  → FREE_CERTIFICATE
```

Căn cứ: khóa free-tier Udemy không cấp certificate of completion, không có Q&A / direct messaging, và khóa free publish sau 17/03/2020 phải dưới 2 giờ video. Ngược lại, học viên vào khóa **trả phí** bằng coupon khuyến mãi / gift / credits được **toàn bộ** tính năng của khóa trả phí, gồm certificate.

```text
https://support.udemy.com/hc/en-us/articles/360040701614-The-Free-Course-Experience
https://support.udemy.com/hc/en-us/articles/1500010482202-Free-Courses-What-Should-Instructors-Know
```

Suy ra dấu hiệu nhận diện deterministic hữu ích:

```text
udemy.com + duration < 120 phút + price 0
   → gần như chắc chắn free-tier → NO_CERTIFICATE
```

## 66.3 Thứ tự ưu tiên khi kết luận certificate

```text
1. MANUAL (editor xác nhận)
2. provider_policies (deterministic)
3. evidence từ trang course (JSON-LD / OG / meta)
4. AI, chỉ khi confidence ≥ 0.8
5. UNKNOWN
```

AI tụt xuống hạng 4. Rule 3 được giữ nguyên và còn được củng cố.

## 66.4 Định nghĩa "free" phải chặt hơn

Bổ sung luật vào `§12`:

```text
Chỉ 100% off mới được coi là free.
Giảm giá một phần → PAID. Không có ngoại lệ.

FREE_TRIAL không phải free
  → không xuất hiện trong bất kỳ list "free" nào
  → phải gắn nhãn thời hạn trial rõ ràng

FREE_AUDIT phải luôn kèm certificate_type
  → audit + PAID_CERTIFICATE là tổ hợp phổ biến nhất, không được để UNKNOWN
```

## 66.5 Trục phân loại mới: độ bền

Đây là phân biệt người học quan tâm hơn cả provider hay level, nhưng plan cũ không có:

```text
free_durability

PERMANENT      free theo thiết kế của provider (MS Learn, freeCodeCamp)
AUDIT_FOREVER  audit miễn phí vô hạn, cert trả phí (Coursera, edX)
LIMITED        có hạn / promo / coupon
UNKNOWN
```

Suy ra deterministic từ `provider + price_type`, không cần AI.

## Milestone M19.1 — Pricing & Certificate Truth

```text
bảng provider_policies + seed 8 provider hiện có
free_durability trên courses (generated / derived)
certificate resolver theo thứ tự §66.3
luật 100%-off + FREE_TRIAL guard
backfill certificate_type cho course đang UNKNOWN
FREE_WITH_COUPON chỉ set được bằng MANUAL
```

Gate:

```text
unit test cho từng rule trong provider_policies
unit test: FREE_TRIAL không bao giờ lọt vào query "free"
0 course Udemy còn certificate_type = UNKNOWN sau backfill
lint / typecheck / test / build PASS
```

Đây là milestone rẻ nhất và có tác động tức thì lên chất lượng dữ liệu đang chạy production. Làm trước tất cả.

---

# 67. COVERAGE — Provider & Taxonomy

## 67.1 Bài toán ngân sách

Query matrix = providers × topics. Ngân sách `§33`: `DISCOVERY_QUERY_LIMIT=15/ngày`.

```text
hiện tại       8 × 12 =  96 query   → vòng lặp   6,4 ngày
+ provider    16 × 12 = 192 query   → vòng lặp  12,8 ngày
+ cả 2        16 × 40 = 640 query   → vòng lặp    43 ngày
```

43 ngày/vòng làm sụp Principle 4 (Freshness matters). Kết luận:

> **Chỉ mở rộng MỘT trục. Mở provider, không mở category.**

## 67.2 Vì sao không thêm top-level category

Nút thắt là **mật độ course/category**, không phải số lượng category. Với ~200–300 published course, mỗi category đang có ~20 course. Thêm 12 category nữa thì mật độ giảm một nửa → hub page rơi dưới ngưỡng thin content → site trông như đã chết.

`§15` giữ nguyên 12 category. Không thảo luận lại trong v1.2.

## 67.3 Độ sâu chủ đề lấy bằng tag, không bằng category

Người ta search "khóa học Power BI miễn phí", không search "category Data". Long-tail nằm dưới tầng category — và lấy được **mà không tốn thêm query nào**:

```text
category (12, cố định)
   └── topic_tags (mở, sinh từ dữ liệu đã có)
```

Nguồn tag, theo thứ tự tin cậy:

```text
1. ai_analysis_json.categories      ← đã lưu sẵn từ WP7, chưa dùng hết
2. keyword deterministic từ title   ← whitelist kỹ thuật, không tự do
3. zero-result search log           ← nhu cầu thật do user tự nói ra
```

Bảng:

```text
topic_tags
id, slug, name_en, name_vi, category_id, source, course_count, active

course_topic_tags
course_id, tag_id, confidence, source
```

Route:

```text
/{locale}/topic/[slug]
```

Ngưỡng index: **≥ 8 published course** — dùng lại đúng guardrail M17. Tag tự vượt ngưỡng thì tự được index; không ai phải quyết định seed bao nhiêu tag.

## 67.4 Search feedback loop

```text
ALTER search_queries (public search log)
  + result_count
  + zero_result
  + clicked_course_id
```

```text
zero-result query
   ↓
admin review
   ↓
promote thành discovery query HOẶC topic tag
```

Người dùng tự nói cho hệ thống biết đang thiếu course gì. Đây là nguồn discovery query chất lượng nhất và miễn phí.

## 67.5 Course URL Classifier — chặn rác trước khi tốn tiền

### Vấn đề

Plan hiện tại chỉ trả lời "đây có phải khóa học không" ở `is_course` trong `§18` — tức là **sau** search + fetch + AI.

```text
search → ingest → source fetch → NVIDIA → is_course: false
         ↑ quota    ↑ bandwidth    ↑ token   ↑ và vẫn chiếm 1 slot review
```

Ví dụ thật:

```text
learn.microsoft.com/en-us/answers/questions/5569357/azure-ai-fundamentals-learning-path-coupon-code-in
```

Đây là bài hỏi đáp trên forum. Nó chứa đủ keyword ("azure", "learning path", "coupon") để lọt search và lọt cả AI nếu confidence thấp — nhưng chặn được bằng **một regex**, không cần token nào.

Chi phí thật của việc thiếu tầng này:

```text
25 query × 5 result = 125 result/ngày
40% rác            = 50 fetch + 50 AI call bỏ đi
                   + 50 item rác trong queue review
```

Nút thắt của hệ thống là thời gian review của con người. Rác vào queue đắt hơn rác tốn token.

### Tầng mới: classify tại ingest

```text
query
 ↓
search
 ↓
normalize            (§10, đã có)
 ↓
CLASSIFY URL SHAPE   ← MỚI, deterministic, 0 external call
 ↓
dedupe               (đã có)
 ↓
candidate  hoặc  INVALID (kèm lý do)
```

`INVALID` đã có trong enum `§9` — chỉ chưa được dùng ở bước này. URL bị loại **không tính vào** `DISCOVERY_RESULT_LIMIT`, để ngân sách dành cho ứng viên thật.

### Provider URL Shape Registry

Mỗi provider khai báo 3 nhóm pattern:

```text
COURSE_PATTERNS      URL là khóa học / learning path
KNOWN_NON_COURSE     forum, blog, docs, profile, search page
UNKNOWN              không match gì → cho qua, để AI quyết
```

Seed:

```text
learn.microsoft.com
  course      /training/modules/**  /training/paths/**
  non-course  /answers/**  /questions/**  /blog/**  /shows/**
              /users/**  /credentials/**  /search**

coursera.org
  course      /learn/**  /specializations/**  /professional-certificates/**
  non-course  /articles/**  /collections/**  /instructor/**  /degrees/**

udemy.com
  course      /course/**
  non-course  /topic/**  /user/**  /courses/search**  /blog/**

edx.org
  course      /learn/**  /course/**  /certificates/**
  non-course  /blog/**  /resources/**  /search**

freecodecamp.org
  course      /learn/**
  non-course  /news/**  /forum/**
```

`UNKNOWN` **không bị reject**. Chặn quá tay còn tệ hơn để rác lọt — mất course thật thì không ai biết mà sửa.

### Negative pattern trong discovery query

Sửa `§55`: query phải hẹp tới đường dẫn, không chỉ tới domain.

```text
SAI    site:learn.microsoft.com AI learning path
ĐÚNG   site:learn.microsoft.com/training AI learning path

SAI    site:udemy.com "free" python course
ĐÚNG   site:udemy.com/course "free" python
```

### Đo được chất lượng từng query

```text
discovery_rejections
id
discovery_query_id
url
reason        NON_COURSE_PATTERN | DUPLICATE | BAD_DOMAIN | MALFORMED
matched_rule
created_at
```

```text
ALTER discovery_queries
  + junk_rate            (rejection / total result, rolling 30 ngày)
  + last_junk_review_at
```

Vòng lặp tự điều chỉnh:

```text
junk_rate > 50% trong 3 lần chạy
  → cảnh báo admin trong /admin/discovery
  → đề xuất sửa query hoặc enabled = false
```

Query rác tự tố giác chính nó. Không cần ai đi rà tay 200 query.

---

## 67.6 Provider Onboarding Checklist

Provider mới **không phải một dòng seed**. Mỗi provider cần 6 artifact deterministic trước khi `active = true`:

```text
1. fetch policy          FETCH_ALLOWED | METADATA_ONLY | NO_FETCH
2. URL normalization rule                        (§10)
3. URL shape registry    COURSE / KNOWN_NON_COURSE (§67.5)
4. price classification rule                     (§12)
5. certificate policy + evidence_url             (§66.2)
6. HTML fixture + snapshot test cho 3 course thật
                         + 2 URL non-course thật
```

Artifact 3 và 6 bắt buộc có case âm: **mỗi provider phải kèm 2 URL thật không phải khóa học** (forum, blog, profile) trong fixture test. Không có case âm thì classifier chỉ được kiểm một chiều.

Tiêu chí chọn provider — theo giá trị dữ liệu, không theo độ nổi tiếng:

```text
free vĩnh viễn (không phải audit)      ← ưu tiên cao nhất
certificate / badge miễn phí
URL ổn định, không bot protection
đủ volume để hub page vượt ngưỡng 8
```

## 68. Provider mục tiêu v1.2

### Nhóm A — Vendor academy (ưu tiên 1)

Thắng Udemy trên mọi trục, đặc biệt sau §65.4: free vĩnh viễn, badge/cert miễn phí, URL ổn định, ít chặn bot, và đúng thứ người học VN đưa vào CV.

```text
Cisco Skills for All / NetAcad
IBM SkillsBuild / Cognitive Class
HubSpot Academy
Google Skillshop + Cloud Skills Boost
Kaggle Learn
NVIDIA DLI
Fortinet Training Institute
Salesforce Trailhead
```

### Nhóm B — OER (ưu tiên 2)

Volume lớn, SEO tốt, phần lớn là audit-free / cert trả phí.

```text
OpenLearn (Open University)
Saylor Academy
MIT OpenCourseWare
Alison
Hugging Face Learn
DeepLearning.AI short courses
```

### Cảnh báo verify

```text
Fortinet, Salesforce Trailhead
  → chính sách certificate/badge hay đổi
  → BẮT BUỘC verify ở bước 4 của checklist trước khi bật active
  → không seed theo giả định
```

v1.2 onboard **6 provider nhóm A**. Nhóm B để v1.3. Thà 6 provider có fixture test đầy đủ hơn 14 provider đoán.

## Milestone M19.2 — Provider Expansion & Taxonomy Depth

```text
CourseUrlClassifier + provider URL shape registry (§67.5)
discovery_rejections + junk_rate trên discovery_queries
sửa toàn bộ discovery query sang path-scoped (§55)
Provider Onboarding Checklist (doc + template test)
onboard 6 provider nhóm A, mỗi cái đủ 6 artifact
topic_tags + course_topic_tags + /topic/[slug]
tag ≥ 8 course mới index (noindex + loại khỏi sitemap nếu dưới)
zero_result flag + admin view
DISCOVERY_QUERY_LIMIT: 15 → 25
```

Gate:

```text
URL forum/blog/profile của cả 14 provider bị loại tại ingest,
  KHÔNG tốn fetch và KHÔNG tốn AI call
URL không match pattern nào → vẫn đi tiếp (không over-block)
mỗi provider có ≥ 3 case dương + 2 case âm PASS
junk_rate hiển thị trong /admin/discovery
tag page dưới ngưỡng: snapshot test xác nhận noindex
vòng lặp query matrix ≤ 8 ngày sau khi nâng limit
```

Làm `CourseUrlClassifier` **trước** khi onboard provider mới. Onboard 6 provider trong khi chưa có classifier là nhân số rác lên gấp đôi.

---

# 69. TIME — Observation & Event Model

## 69.1 Kiến trúc: thêm đúng một service

```text
Vercel cron KHÔNG phù hợp để quan sát vài nghìn URL/ngày
  → function timeout
  → không rate-limit per-domain
  → không backoff theo provider
```

Topology mới:

```text
apps/web        Next.js (Vercel, như hiện tại)
apps/monitor    long-running worker (Railway / Fly / Render)
packages/db     Drizzle schema + repositories   (shared)
packages/domain business rules                  (shared)
```

Queue: **Postgres-backed** (Graphile Worker / pg-boss) trên đúng Neon hiện có.

```text
KHÔNG Redis
KHÔNG Kafka
KHÔNG time-series DB
KHÔNG headless browser farm
```

PostgreSQL vẫn là source of truth duy nhất — Master Instruction #12 không bị vi phạm.

### Ranh giới service (bất biến)

```text
monitor ĐƯỢC ghi:  course_observations, course_price_events, api_usage_log
monitor ĐƯỢC set:  availability flag + price_type khi event CONFIRMED
monitor KHÔNG ĐƯỢC: publish, approve candidate, tạo course mới
```

Rule 7 giữ nguyên: **không có đường nào để máy tự publish.**

## 69.2 Ba lớp dữ liệu

```text
observations   SỰ THẬT THÔ        append-only, không UPDATE, không DELETE
      ↓
events         CHUYỂN TRẠNG THÁI  đã xác nhận, chống nhiễu
      ↓
verifications  QUYẾT ĐỊNH TIN CẬY đã có từ M16, giữ nguyên, thành lớp dẫn xuất
```

`course_verifications` **không bị thay thế**. Nó đọc từ observations.

### course_observations

```text
id
course_id
observed_at

fetch_status        OK | NOT_FOUND | BLOCKED | TIMEOUT | ERROR
http_status
final_url
content_hash
etag

price_type
price_amount
currency
observed_region     ← BẮT BUỘC, giá khác nhau theo vùng

certificate_type
enrollment_open

evidence_url
evidence_snippet    bounded + sanitized
extraction_method   JSON_LD | OG | HTML_META | PROVIDER_API | SEARCH | AI | MANUAL
confidence

fetch_policy_used
worker_version      ← biết dữ liệu cũ do logic nào tạo ra
created_at
```

### course_price_events

```text
id
course_id
event_type   WENT_FREE | WENT_PAID | PRICE_CHANGED
             | CERT_CHANGED | DELISTED | RETURNED
from_state   json
to_state     json
first_seen_at
confirmed_at
confirming_observation_ids  json
region
is_public
created_at
```

### course_watches

```text
id, course_id, email, locale
status        PENDING | CONFIRMED | NOTIFIED | UNSUBSCRIBED
confirm_token, unsubscribe_token
created_at, confirmed_at, notified_at
```

### Bổ sung courses (append-only, Rule 10)

```text
ALTER courses
  + tracking_tier          HIGH | NORMAL | LOW | DORMANT
  + last_observed_at
  + next_observation_at
  + volatility_score
  + free_streak_started_at
  + typical_price_amount
  + observation_count
  + free_durability                     (§66.5)
```

## 69.3 Chống nhiễu — phần khó nhất của v1.2

Giá khóa học nhiễu tự nhiên: A/B test, geo pricing, flash sale vài giờ, cache CDN. **Một alert sai là mất subscriber vĩnh viễn.**

### Luật xác nhận event

```text
≥ 2 observation liên tiếp cùng kết quả
cách nhau ≥ 2 giờ
cùng observed_region
```

và:

```text
cả 2 deterministic (JSON_LD / OG / PROVIDER_API)
   HOẶC
1 deterministic + 1 AI với confidence ≥ 0.8
```

Riêng `DELISTED`:

```text
≥ 3 observation NOT_FOUND, trải ≥ 24 giờ
```

### Luật khác

```text
BLOCKED / TIMEOUT / ERROR  KHÔNG BAO GIỜ tạo event → chỉ tăng backoff
region không xác định       → không tạo PRICE_CHANGED
cooldown                    1 event / course / event_type / 24h
```

### Auto-status được phép tới đâu

```text
CONFIRMED DELISTED     → course.status = UNAVAILABLE       tự động
CONFIRMED WENT_PAID    → price_type update + badge         tự động
CONFIRMED WENT_FREE    → price_type update + alert         tự động
thay đổi khác          → hàng đợi admin
publish / unpublish    → LUÔN LUÔN là người
```

Mở rộng có kiểm soát của Principle 3: máy được cập nhật **thuộc tính đã quan sát được**, không được quyết định **thứ gì được xuất hiện**.

## 69.4 Adaptive Scheduling

Ngân sách fetch chảy về nơi có khả năng thay đổi:

```text
HIGH     6h      TEMPORARILY_FREE, có watcher, volatility cao
NORMAL   24h     FREE_FULL / FREE_AUDIT published, top clicked 30 ngày
LOW      7 ngày  không đổi ≥ 60 ngày, PAID không watcher
DORMANT  30 ngày UNAVAILABLE / ARCHIVED đã xác nhận
```

`volatility_score` = số event / số observation trong 90 ngày.

Backoff theo domain:

```text
BLOCKED liên tiếp → 2h → 6h → 24h → 7 ngày
provider bị chặn ≥ 3 ngày → tự hạ METADATA_ONLY + cảnh báo admin
```

Coverage SLO, hiển thị trong `/admin`:

```text
≥ 95% published course được observe đúng tier của nó
```

## Milestone M19.3 — Observation Model & Backfill

```text
3 bảng mới + ALTER courses
backfill course_observations từ course_verifications lịch sử
  (extraction_method = MANUAL/legacy, worker_version = 0)
repository layer + unit test
```

Backfill trước, để ngày launch chart không rỗng.

Gate: `course_verifications` cũ vẫn đọc/ghi bình thường sau migration.

## Milestone M19.4 — Monorepo Split

```text
pnpm workspace
apps/web + packages/db + packages/domain
CI build cả hai
Vercel deploy không đổi hành vi
```

Gate: **zero behavior change**. Có bug UI ở bước này là làm sai.

## Milestone M19.5 — Monitor Worker

```text
apps/monitor + Postgres queue
tái dùng CourseSourceFetcher (M18.4) — KHÔNG viết fetcher mới
per-domain rate limit + conditional request (ETag / If-Modified-Since)
backoff, budget, kill switch
api_usage_log
```

Gate:

```text
chạy 48h staging: 0 vi phạm fetch policy, 0 SSRF
ghi được observation cho ≥ 200 course
```

## Milestone M19.6 — Extraction & Price Amount

```text
JSON_LD → OG → HTML_META → PROVIDER_API → SEARCH → AI (fallback cuối)
parse price_amount + currency + region
provider rule registry cho 8 + 6 provider
snapshot test bằng HTML fixture đã lưu
```

AI chỉ chạy khi deterministic thất bại.

## Milestone M19.7 — Event Detection

```text
transition engine + luật §69.3
cooldown, region guard, blocked guard
auto-status trong giới hạn cho phép
admin queue cho thay đổi bất thường
```

Gate:

```text
unit test: flapping, geo, A/B, blocked, delisted
replay 30 ngày dữ liệu thật → 0 false event
```

---

# 70. UX — Từ vựng trạng thái theo thời gian

## 70.1 Vì sao cần, dù vừa redesign

M18.2 thiết kế cho directory: card hiện **trạng thái tĩnh** (free, certificate, level, duration). v1.2 biến sản phẩm thành tracker, UI phải nói được những thứ chưa có chỗ để nói:

```text
đang miễn phí BAO LÂU rồi
kiểm tra lần cuối KHI NÀO
miễn phí VĨNH VIỄN hay CÓ HẠN
dữ liệu ĐÁNG TIN tới đâu
đã từng miễn phí BAO NHIÊU LẦN
```

Không có từ vựng này thì M19 rơi vào chỗ trống: worker quan sát rất giỏi mà người dùng không thấy gì khác trước.

**v1.2 không đổi màu, typography, layout.** Chỉ thêm từ vựng vào hệ thống đã có.

## 70.2 Badge hierarchy — bắt buộc chốt trước khi code

`§56` đã có luật "Free status nổi bật hơn AI score". v1.2 thêm 3 loại nhãn nữa, nếu không chốt hierarchy thì card thành mớ badge:

```text
Tầng 1   free status + free_durability     (to nhất)
Tầng 2   certificate — GỒM CẢ "Không có chứng chỉ"
Tầng 3   thời gian: "Free 12 ngày" / "Kiểm tra 4h trước"
Tầng 4   AI score (nhỏ nhất, giữ nguyên)
```

Luật cứng:

```text
Card KHÔNG BAO GIỜ hiện quá 3 badge.
Badge thứ 4 trở đi đẩy xuống trang detail.
```

Hệ quả trực tiếp của §66.2: course Udemy `FREE_FULL` phải hiện rõ **"Không có chứng chỉ"** ngay trên card — đây là thông tin chống thất vọng, không phải thông tin phụ.

## 70.3 Hiển thị độ không chắc chắn

Phần dễ mất uy tín nhất. Tracker im lặng về dữ liệu cũ thì tệ hơn không có tracker.

```text
< 24h        "Kiểm tra 4 giờ trước"       bình thường
1–7 ngày     "Kiểm tra 3 ngày trước"      nhạt màu
> 7 ngày     "Chưa kiểm tra gần đây"      cảnh báo nhẹ
NO_FETCH     "Theo tín hiệu tìm kiếm"     + ẩn chart
BLOCKED      không nói gì về giá cả
```

Nguyên tắc: **thà nói "không biết" còn hơn hiện số cũ như số mới.**

## 70.4 Empty state cho dữ liệu lịch sử

Course mới publish có 1 observation, không vẽ được chart. Phải quy định rõ, không để component tự xử:

```text
< 3 observation    ẩn hoàn toàn khu vực lịch sử
3–10               chỉ text, không chart
> 10               sparkline
```

Bỏ qua mục này thì ngày launch 90% course hiện chart một điểm — trông như bug.

## 70.5 Ràng buộc riêng của dự án

```text
Mobile-first thật
  sparkline phải đọc được ở 380px
  không trục, không tooltip hover, chỉ hình dạng + 2 mốc text
  chart desktop-first sẽ phải làm lại

Text VI dài hơn ~25%
  "Đã miễn phí 3 lần trong 12 tháng" vs "Free 3 times in 12 months"
  test locale VI TRƯỚC, không phải EN trước
  mở rộng test completeness của M18.3 sang overflow layout ở VI

A11y cho chart
  sparkline là SVG → screen reader đọc rỗng
  aria-label text tương đương BẮT BUỘC
  không dùng riêng màu để phân biệt free/paid trên timeline
```

## Milestone M19.8 — UX Vocabulary & Design Tokens

```text
token cho trust / staleness state (DESIGN_SYSTEM.md)
quy tắc uncertainty (UI_UX_GUIDELINES.md)
badge hierarchy component + luật max 3
staleness label component (EN/VI)
empty state rule cho khu vực lịch sử
```

Gate:

```text
card không vượt 3 badge ở MỌI tổ hợp trạng thái (snapshot test)
locale VI không overflow ở 380px
Udemy FREE_FULL luôn hiện "Không có chứng chỉ"
```

Làm M19.8 **trước** M19.9. Không code UI tracker khi chưa có từ vựng.

---

# 71. Bề mặt công khai

Mọi route mới **bắt buộc bilingual ngay trong cùng milestone** (LocalizedLink + dictionaries của M18.3). Không làm EN trước VI sau.

## Course detail — bổ sung

```text
Đang miễn phí — 12 ngày rồi      / Free for 12 days
Thường có giá $89.99              / Typically $89.99
Đã miễn phí 3 lần trong 12 tháng  / Free 3 times in 12 months
Kiểm tra lần cuối: 4 giờ trước    / Last checked 4 hours ago
[sparkline 90 ngày — theo luật §70.4]
```

Provider `NO_FETCH`: ẩn chart, chỉ hiện "theo tín hiệu tìm kiếm".

## Route mới

```text
/{locale}/tracker
    Vừa miễn phí hôm nay
    Miễn phí lâu nhất
    Vừa quay lại tính phí

/{locale}/course/[slug]/history          indexable, evergreen
/{locale}/topic/[slug]                   (M19.2)
/{locale}/collections/just-went-free     dynamic, dùng UI collections M17
```

## Phân phối

```text
/feed/free-now.xml         RSS
/api/public/events         JSON, read-only, rate-limited, cache 5 phút
```

Feed là kênh phân phối rẻ nhất: aggregator tự lấy về, tạo backlink mà không cần marketing.

Mọi link ra ngoài vẫn qua `/course/[slug]/go?utm_source=tracker|alert|feed|topic` để đo bằng `outbound_clicks` đã có.

## Milestone M19.9 — Public Tracker UI

```text
sparkline + free streak + typical price
/tracker, /course/[slug]/history, just-went-free
bilingual đầy đủ, hreflang, sitemap
NO_FETCH degrade đúng
```

Gate:

```text
Lighthouse mobile: Perf ≥ 90, SEO ≥ 95
snapshot test: course 1 / 5 / 50 observation
sparkline có text equivalent
```

---

# 72. Deal Alert (transactional only)

Chưa có email infra → v1.2 thêm **tối thiểu**, không làm newsletter.

```ts
interface EmailProvider {
  send(input: EmailInput): Promise<EmailSendResult>;
}
```

```text
ResendEmailProvider
```

Chỉ 2 loại email:

```text
CONFIRM_WATCH
COURSE_WENT_FREE
```

Bắt buộc:

```text
double opt-in
1-click unsubscribe (RFC 8058)
chỉ lưu email + locale
subdomain riêng + SPF/DKIM/DMARC
bounce/complaint webhook → cập nhật status
EMAIL_DRY_RUN cho dev
```

Nút đặt đúng chỗ trước đây là dead-end:

```text
course EXPIRED / PAID → [ Thông báo khi miễn phí lại ]
```

Trang EXPIRED từ chỗ mất khách thành chỗ thu email.

## Milestone M19.10 — Alerts & Feed

```text
EmailProvider + watch flow + double opt-in
alert khi WENT_FREE confirmed
RSS + public JSON API + rate limit
```

Gate:

```text
E2E: watch → confirm → event → email → unsubscribe
1 email lỗi không làm fail cả batch
không gửi trùng cùng course cho cùng email
```

---

# 73. Thứ tự triển khai

```text
M19.0  Admin Foundation & Throughput
M19.1  Truth Rules
M19.2  Provider + Taxonomy
```

### STOP 1.

Ba milestone này cải thiện sản phẩm đang chạy production mà chưa thêm hạ tầng nào. Nếu v1.2 phải dừng vì bất cứ lý do gì, dừng ở đây vẫn có lời.

M19.0 đứng đầu vì audit log phải có **trước** khi M19.1 backfill hàng loạt certificate_type và trước khi M19.7 cho worker tự đổi status. Thêm audit log sau khi đã có dữ liệu bị đổi thì mất luôn phần lịch sử quan trọng nhất.

```text
M19.3  Observation Model
M19.4  Monorepo Split
M19.5  Monitor Worker
```

### STOP 2 — điểm quyết định.

Cho worker chạy 1 tuần, **chỉ ghi observation**, chưa tạo event, chưa lộ UI. Đọc log: provider nào chặn, BLOCKED rate bao nhiêu.

```text
Tier-1 BLOCKED > 40%
  → tracker chỉ phủ được nhóm academy + freeCodeCamp + MS Learn
  → DỪNG, không đổ tiền vào M19.6+
  → quay lại M18.5
```

```text
M19.6  Extraction
M19.7  Event Detection
```

### STOP 3.

Replay 30 ngày dữ liệu thật. Còn false event thì **không mở UI**.

```text
M19.8  UX Vocabulary
M19.9  Tracker UI
M19.10 Alerts & Feed
```

Gate cũ (`lint / typecheck / test / build`) áp dụng cho **từng** milestone như WP18. Không gộp milestone vào một prompt.

---

# 74. Env Variables mới

```bash
# Monitor worker
MONITOR_DATABASE_URL=
MONITOR_CONCURRENCY=
MONITOR_DAILY_FETCH_BUDGET=
MONITOR_PER_DOMAIN_RPM=
MONITOR_USER_AGENT=
MONITOR_WORKER_VERSION=

# Email (transactional only)
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_REPLY_TO=
EMAIL_DAILY_BUDGET=
EMAIL_DRY_RUN=

# Discovery (nâng từ §33)
DISCOVERY_QUERY_LIMIT=25

# Feature flags — mặc định OFF khi deploy
FEATURE_TRACKER_UI=
FEATURE_PRICE_ALERTS=
FEATURE_PUBLIC_FEED=
FEATURE_AUTO_STATUS=
FEATURE_TOPIC_PAGES=
```

Validate bằng Zod như cũ.

---

# 75. Metrics v1.2

North Star **không đổi**: Outbound Course Clicks.

```text
CONTROL
  thời gian review trung bình / candidate     ← mục tiêu < 12 giây
  candidate duyệt / phiên làm việc
  % action có audit log                       ← mục tiêu 100%
  auto-reject bị undo                         ← > 5% thì rule quá tay
  queue depth (READY_FOR_REVIEW)              ← không được tăng đơn điệu
  EXPIRED_UNREVIEWED / tuần                   ← cao = queue quá tải
```

```text
TRUTH
  % course có certificate_type ≠ UNKNOWN     ← mục tiêu > 90%
  số lần editor phải sửa certificate sau publish

COVERAGE
  published course / category (mật độ, không phải tổng)
  topic page vượt ngưỡng 8
  zero-result rate (giảm dần)
  vòng lặp query matrix (ngày)
  junk_rate trung bình toàn bộ query    ← mục tiêu < 15%
  % candidate bị is_course = false      ← nếu > 10% thì classifier còn hở
  số item admin phải reject vì "không phải khóa học" ← mục tiêu ~0

TIME
  observation coverage % theo tier
  BLOCKED rate theo provider
  median detection latency (giờ)
  false event count                          ← mục tiêu 0

SẢN PHẨM
  watch requests / confirm rate
  alert → outbound CTR
  /tracker traffic + returning visitor %
  feed subscribers / referrer từ aggregator
```

Tín hiệu pivot mạnh:

```text
alert → outbound CTR > 25%
  → người dùng quan tâm THỜI ĐIỂM hơn DANH SÁCH
  → v1.3 đi sâu tracking, không đi rộng catalog
```

---

# 76. Rủi ro & điểm dừng

```text
Provider chặn bot
  → đo ở STOP 2, Tier-1 > 40% thì dừng

ToS
  → chỉ fetch trang course public, tôn trọng robots.txt
  → không bypass chặn, không đăng nhập, UA có contact URL
  → rà ToS từng provider trước khi bật FETCH_ALLOWED

Geo pricing
  → observed_region bắt buộc, không so sánh chéo vùng

Alert sai
  → luật xác nhận + cooldown + replay test bắt buộc

Provider mới seed theo giả định
  → checklist 5 artifact, fixture test trước khi active

Thin content khi mở topic page
  → ngưỡng 8 course, noindex tự động

Chi phí worker
  → budget cứng, adaptive tier, conditional request giảm ~60% byte

Scope creep
  → không semantic search, learning path, account, redesign trong v1.2
```

---

# 77. Bổ sung Cursor Master Instruction (§63)

```text
18. Không viết fetcher mới. Mọi HTTP ra ngoài đi qua CourseSourceFetcher (M18.4).
19. Provider fetch policy là luật. NO_FETCH không có ngoại lệ.
20. course_observations append-only. Không UPDATE, không DELETE.
21. Không tạo event từ BLOCKED / TIMEOUT / ERROR.
22. Không so sánh giá khác observed_region.
23. monitor không được publish, approve, hay tạo course.
24. Certificate kết luận theo thứ tự §66.3. AI là hạng 4, không phải hạng 1.
25. Chỉ 100% off là free. FREE_TRIAL không bao giờ vào list free.
26. Provider mới cần đủ 6 artifact của checklist trước khi active = true.
26b. Classify URL shape tại ingest, trước fetch và trước AI. is_course của AI
     là lưới cuối, không phải lưới đầu.
26c. URL không match pattern nào thì cho đi tiếp. Không over-block.
26d. Discovery query phải path-scoped, không chỉ domain-scoped.
27. Không thêm top-level category trong v1.2.
28. Route công khai mới phải có EN + VI trong cùng milestone.
29. Card không vượt 3 badge. Badge thứ 4 xuống trang detail.
30. Không gửi email ngoài 2 loại transactional đã định nghĩa.
31. Mọi external call ghi api_usage_log kèm worker_version.
32. Mọi feature v1.2 tắt được bằng feature flag, mặc định OFF khi deploy.
33. MỌI thay đổi state ghi admin_audit_log — kể cả worker, cron, AI.
34. RBAC enforce ở server. Ẩn nút trên UI không phải bảo mật.
35. Auto-reject được phép và phải undo được. Auto-approve vẫn bị cấm.
36. Milestone tạo ra entity mới thì phải ship UI quản trị cho entity đó
    trong cùng milestone. Không có UI = milestone chưa xong.
37. Dashboard chỉ hiện con số nào click được vào đúng filter.
```

---

# 79. CONTROL — Admin & Operations

## 79.1 Vấn đề: admin đang là nút thắt, và v1.2 sẽ làm nó nặng thêm

Admin hiện tại:

```text
§28  dashboard = 6 con số đếm, không click được vào đâu
§29  review từng cái một, FIFO, không bulk, không keyboard
§30  manual add
§31  chỉ có nút Run Discovery
```

Bảng đã tồn tại trong DB nhưng **không có UI nào để sửa**:

```text
providers          ai đổi affiliate_template? fetch_policy?
discovery_queries  chỉ seed được, không sửa/thêm/tắt được
categories         không quản lý được
collections (M17)  có route công khai nhưng không có công cụ curate
users              schema có ADMIN/EDITOR nhưng không có trang quản lý
```

Và **không có audit log**. Đây là vấn đề nghiêm trọng nhất: M19.7 sắp cho worker tự đổi `status` và `price_type`. Không có audit log thì khi dữ liệu sai, không ai truy được là worker đổi, editor đổi, hay AI đổi — và không có đường undo.

Nghĩa vụ quản trị **mới** mà v1.2 tạo ra:

```text
M19.1   provider_policies         cần UI review + effective_from
M19.2   URL shape registry        cần UI test thử URL
M19.2   junk_rate per query       cần UI xem + tắt query rác
M19.2   topic_tags               cần UI merge / rename / gán category
M19.5   monitor worker            cần UI xem health + pause + budget
M19.7   event queue              cần UI xem event bất thường + undo
M19.10  watchers                 cần UI xem ai đang chờ course nào
```

Nếu không có kế hoạch, mỗi milestone sẽ tự bolt thêm một trang admin rời rạc.

## 79.2 Nguyên tắc: admin surface là deliverable của từng milestone

```text
KHÔNG dồn admin vào một milestone cuối.
Mỗi milestone tự ship UI quản trị cho thứ nó tạo ra.
Milestone chưa có UI quản trị = CHƯA XONG.
```

M19.0 chỉ làm phần **dùng chung**, để các milestone sau không phải phát minh lại.

## 79.3 Audit log — nền tảng bắt buộc

```text
admin_audit_log

id
actor_type       USER | WORKER | CRON | AI
actor_id         (nullable với WORKER/CRON)
action           APPROVE | REJECT | PUBLISH | UNPUBLISH | EDIT
                 | AUTO_STATUS_CHANGE | POLICY_CHANGE
                 | QUERY_TOGGLE | BULK_ACTION | LOGIN | ...
entity_type      course | candidate | provider | query | policy | tag | user
entity_id
before_json      snapshot trước
after_json       snapshot sau
reason           (bắt buộc với reject / unpublish / policy change)
request_id
created_at
```

Luật:

```text
MỌI thay đổi state đi qua audit log — kể cả worker và cron.
Bulk action ghi 1 dòng BULK_ACTION + N dòng con, cùng request_id.
Undo được dựng từ before_json, không cần bảng riêng.
Audit log append-only. Không sửa, không xóa.
```

Đây cũng là yêu cầu bảo mật còn thiếu sau M15: M15 khóa được *ai vào được*, nhưng không ghi *họ đã làm gì*.

## 79.4 RBAC — làm rõ ADMIN vs EDITOR

Schema có 2 role từ WP1 nhưng plan chưa định nghĩa quyền. Chốt:

```text
EDITOR
  review candidate: approve / reject / edit / re-analyze
  edit course, publish / unpublish
  curate collections, gán topic tag
  xem analytics

ADMIN  (toàn bộ EDITOR, cộng thêm)
  providers + fetch policy + affiliate template
  provider_policies (certificate / pricing rule)
  discovery queries: thêm / sửa / tắt
  URL shape registry
  users + role
  feature flags, budget, worker pause/resume
  xem audit log đầy đủ
```

Luật: **hành động phá hủy hoặc ảnh hưởng toàn hệ thống → ADMIN only.** Editor không được đổi rule, chỉ được áp dụng rule.

## 79.5 Operator throughput — nút thắt thật

Discovery chạy hàng ngày thì bottleneck là **phút chú ý của con người**, không phải quota API.

### Review queue: xếp theo giá trị, không FIFO

```text
priority =
    provider_tier          (Tier-1 cao hơn)
  + price_type value       (FREE_FULL > FREE_AUDIT > khác)
  + ai_confidence
  + free_durability        (PERMANENT cao hơn LIMITED)
  − staleness penalty
```

Admin review 30 item giá trị cao thay vì 30 item đến trước.

### Bulk + keyboard

```text
bulk approve / bulk reject (kèm reason)
j / k   di chuyển
a / r   approve / reject
e       edit
u       undo hành động vừa rồi
```

### Saved views

```text
"Tier-1 + FREE_FULL + confidence cao"     ← duyệt nhanh
"Confidence thấp"                          ← duyệt kỹ
"ERROR cần re-analyze"
"Provider mới onboard"
```

### Deterministic auto-reject (KHÔNG phải auto-approve)

```text
URL không match COURSE_PATTERNS       (§67.5)
DUPLICATE canonical_url
evidence PAID rõ ràng
domain blacklist
is_course = false với confidence ≥ 0.9
```

Mọi auto-reject:

```text
ghi rule đã match vào audit log
hiện trong view "Auto-rejected" để spot-check
undo được 1 click
```

Ranh giới bất biến: **auto-reject được phép, auto-approve thì không.**

### Chống phình queue

```text
candidate READY_FOR_REVIEW > 30 ngày chưa duyệt
  → status EXPIRED_UNREVIEWED
  → ra khỏi queue, vẫn tra được
```

Queue 2.000 item không phải backlog, đó là queue đã chết.

## 79.6 Entity management — bù các bảng chưa có UI

```text
/admin/providers
  CRUD + fetch_policy + affiliate_template + active
  URL shape registry + hộp "thử URL này" xem classify ra gì
  provider_policies (certificate/pricing) + evidence_url + effective_from

/admin/discovery/queries
  CRUD + enable/disable
  junk_rate + zero_result, sort theo junk_rate
  promote zero-result search → query mới (1 click)

/admin/taxonomy
  categories (12, chỉ sửa tên/mô tả — KHÔNG thêm, §67.2)
  topic_tags: merge, rename, gán category, xem course_count vs ngưỡng 8

/admin/collections
  curate: thêm/bớt/sắp thứ tự course, editor_note, publish

/admin/users
  invite, đổi role, deactivate — ADMIN only
```

## 79.7 Ops visibility

```text
/admin/ops

cron run history        (thời gian, kết quả, số item, lỗi)
worker health           (M19.5: queue depth, throughput, last heartbeat)
budget vs limit         (search / AI / email / fetch — hôm nay + 7 ngày)
BLOCKED rate per provider
coverage SLO            (§69.4, mục tiêu ≥ 95%)
pause / resume worker   (ADMIN only)
feature flag toggle     (ADMIN only)
```

## 79.8 Data quality dashboard

Dashboard §28 đổi từ "6 con số" sang **danh sách việc cần làm**, mỗi dòng click được vào đúng filter:

```text
certificate_type = UNKNOWN                  → 42 course
verification cũ hơn 30 ngày                 → 118 course
published nhưng chưa observe lần nào        → 7 course
topic page dưới ngưỡng 8                    → 23 tag
query junk_rate > 50%                       → 4 query
event bất thường chờ xem                    → 3 event
candidate ERROR                             → 11 item
```

Nguyên tắc: **con số nào không click được thì đừng hiện.** Dashboard là danh sách việc, không phải bảng điểm.

## Milestone M19.0 — Admin Foundation & Throughput

```text
admin_audit_log + ghi log ở MỌI đường đổi state hiện có
RBAC enforcement ADMIN vs EDITOR (server-side, không chỉ ẩn UI)
bulk action framework + undo từ before_json
keyboard shortcuts trong review queue
saved views + review priority ordering
deterministic auto-reject + view "Auto-rejected"
EXPIRED_UNREVIEWED cho candidate quá 30 ngày
/admin/providers, /admin/discovery/queries, /admin/users
dashboard §28 → danh sách việc click được
```

Gate:

```text
mọi action đổi state đều có dòng audit log (test cho từng route)
EDITOR bị chặn server-side ở mọi action ADMIN-only
bulk 50 candidate → 1 BULK_ACTION + 50 dòng con cùng request_id
undo hoàn nguyên đúng before_json
auto-reject có thể undo, và log rule đã match
review 50 candidate < 10 phút (đo thật, không estimate)
lint / typecheck / test / build PASS
```

Hoãn sang các milestone sau (mỗi cái đi kèm milestone của nó):

```text
/admin/taxonomy        → M19.2
/admin/collections     → M19.2
/admin/ops worker      → M19.5
event review + undo    → M19.7
watcher list           → M19.10
```

---

Sửa tại chỗ trong `project-plan.md`, đánh dấu `(v1.2)`:

```text
§11  Data Model — users
       + định nghĩa quyền ADMIN vs EDITOR (§79.4)
       + enforce server-side, không chỉ ẩn UI

§28  Admin Dashboard
       6 con số đếm → danh sách việc cần làm, mỗi dòng click được (§79.8)

§29  Candidate Review
       + review priority ordering thay FIFO (§79.5)
       + bulk action + keyboard + saved views
       + auto-reject deterministic + undo
       + EXPIRED_UNREVIEWED sau 30 ngày

§30  Manual Add — giữ nguyên, đây vẫn là fallback quan trọng nhất

§31  Discovery Admin
       + CRUD discovery_queries (đang chỉ seed được)
       + junk_rate + promote zero-result → query
       + hộp thử URL để xem classifier trả gì (§67.5)

§35  Logging
       + admin_audit_log (§79.3) — append-only
       + cron run history + worker health trong /admin/ops

§36  Security
       + M15 khóa được "ai vào được", audit log ghi "họ làm gì"
       + hành động phá hủy → ADMIN only

§9   Candidate Pipeline
       + bước CLASSIFY giữa normalize và dedupe (§67.5)
       + INVALID kèm lý do, không tính vào DISCOVERY_RESULT_LIMIT

§10  URL Normalization
       + rule cho 6 provider mới (M19.2)
       + tách rõ: normalize ≠ classify. Hai việc khác nhau.

§18  AI Analysis Schema
       + is_course là lưới CUỐI, không phải lưới đầu
       + nếu is_course = false nhiều → sửa classifier, không sửa prompt

§34  Search Queries Table
       + junk_rate + last_junk_review_at
       + junk_rate > 50% trong 3 lần chạy → cảnh báo admin

§55  Initial Discovery Queries
       + toàn bộ query phải path-scoped:
         site:learn.microsoft.com/training  (không phải /learn.microsoft.com)
         site:udemy.com/course
         site:coursera.org/learn

§12  Pricing Classification
       + "chỉ 100% off là free"
       + FREE_TRIAL không vào list free
       + FREE_WITH_COUPON chỉ set bằng MANUAL (lý do: §65.4)
       + free_durability (§66.5)

§13  Certificate Classification
       + provider_policies deterministic (§66.2)
       + thứ tự ưu tiên kết luận (§66.3)
       + FREE_AUDIT bắt buộc có certificate_type

§15  Category — GIỮ NGUYÊN 12 category, không mở rộng (§67.2)

§23  Course Card
       + badge hierarchy 4 tầng, max 3 badge
       + Udemy FREE_FULL phải hiện "Không có chứng chỉ"

§24  Course Detail
       + khu vực lịch sử giá + luật empty state (§70.4)
       + staleness label

§25  Category Page
       + filter free_durability: Vĩnh viễn | Có hạn

§26  Search
       + zero_result log + clicked_course_id

§33  Batch Safety
       DISCOVERY_QUERY_LIMIT 15 → 25

§44  Verification Strategy
       + adaptive tier (§69.4) thay cho priority list phẳng

§56  MVP UI Direction
       + từ vựng trạng thái thời gian
       + luật hiển thị độ không chắc chắn
       + mobile-first cho sparkline, test VI trước
```

---

# 78. Changelog

```text
v1.0    WP0 → WP14              MVP
v1.1    M15 → M17               Hardening, Intelligence, SEO Growth
v1.1.x  WP18 (M18.1 → M18.4)    Polish, I18N, Source Fetching
v1.2    M19 (M19.0 → M19.10)    Control, Coverage, Truth & Time
```

Đề xuất đổi tiêu đề tài liệu gốc:

```text
FreeLearn Radar — MVP Project Plan
        ↓
FreeLearn Radar — Project Plan (v1.2)
```

`M18.5` giữ trạng thái deferred — là đích quay về nếu STOP 2 cho kết quả xấu.
