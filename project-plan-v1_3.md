# FreeLearn Radar — **v1.3 / M20**

## Smart Discovery, Relevance & Decision Intelligence

> Addendum tiếp theo của `project-plan-v1.2.md`. v1.2 đã deploy production.
> v1.3 **không thay đổi** invariant về Truth, Source Fetching, Provider Policy,
> Observation và Audit. M20 chỉ bắt đầu sau khi hoàn tất **v1.2 Production
> Audit / Release Baseline** (§81) **và** sau khi vượt **Precondition Check**
> (§80.2).
>
> Tài liệu này thay thế bản nháp v1.3 trước đó. Khác biệt liệt kê ở §112.

---

# 80. Định vị v1.3

## 80.1 Từ "biết khóa nào đang free" sang "tìm đúng khóa nên học"

v1.2 đã xây bốn trục:

```text
CONTROL    vận hành và audit
TRUTH      free/certificate đúng
COVERAGE   provider + taxonomy
TIME       observation + tracker + alert
```

v1.3 thêm ba trục:

```text
DISCOVERY   hiểu người dùng đang muốn học gì
RELEVANCE   xếp đúng khóa học lên trước
DECISION    giúp người dùng chọn giữa các lựa chọn phù hợp
```

Định vị:

```text
v1.2
"Nơi biết chính xác khóa nào ĐANG miễn phí,
 miễn phí từ khi nào, có chứng chỉ thật không,
 và dữ liệu được kiểm lần cuối lúc nào"

        ↓

v1.3
"Không chỉ tìm khóa học miễn phí.
 Tìm đúng khóa học miễn phí phù hợp với mục tiêu của bạn."
```

North Star **không đổi**: `Outbound Course Clicks`.

v1.3 không tối ưu số lượng kết quả. v1.3 tối ưu khả năng đưa người dùng từ **ý
định học** tới **course phù hợp và đáng tin**.

## 80.2 Precondition Check — v1.3 có phải bài toán đúng không

v1.1 `§60` và v1.2 `§75` đã đặt sẵn tiêu chí quyết định. **Không được bỏ qua
tiêu chí do chính mình đặt ra.** Trước khi mở M20, phải điền bảng này bằng số
thật từ production:

```text
[  ] outbound CTR tổng                     = ____%
[  ] traffic/tháng (sessions)              = ____
[  ] returning visitor %                   = ____%
[  ] alert → outbound CTR      (v1.2 §75)  = ____%
[  ] search → detail CTR                   = ____%
[  ] % session có dùng search               = ____%
[  ] zero-result rate hiện tại             = ____%
```

Đọc kết quả theo `§60`:

```text
traffic CÓ + outbound CTR THẤP
  → đúng là bài toán relevance/ranking
  → v1.3 như tài liệu này

traffic THẤP + CTR CAO
  → bài toán distribution/SEO
  → v1.3 sai trục. Ưu tiên SEO/feed/aggregator trước.

traffic THẤP + CTR THẤP + returning THẤP
  → bài toán value proposition
  → không giải bằng 11 milestone discovery
```

Chốt thêm theo v1.2 `§75`:

```text
alert → outbound CTR > 25%
  → người dùng quan tâm THỜI ĐIỂM hơn DANH SÁCH
  → v1.2 đã kết luận: v1.3 đi SÂU tracking, không đi RỘNG discovery
  → nếu số này > 25%, phải viết quyết định ghi đè rõ ràng
    (ai quyết, vì sao, đánh đổi gì) trước khi chạy M20
```

Nếu `% session có dùng search < 15%`, search không phải nút thắt chính. Ghi
nhận và cân nhắc giảm scope v1.3 xuống M20.0 → M20.4 (relevance) và hoãn nhóm
Decision (Compare, Learning Path).

**Không có bảng này thì không mở M20.**

## 80.3 Ràng buộc quy mô catalog

Catalog hiện tại ~200–300 published course (v1.2 `§67.2`).

```text
Semantic search sắp xếp lại tập hợp đang có.
Semantic search KHÔNG tạo ra course không tồn tại.
```

Hệ quả bắt buộc: trước khi tối ưu retrieval, phải biết zero-result đến từ đâu
(§86.3). Nếu phần lớn là **thiếu course**, ngân sách phải về COVERAGE, không
về embedding.

---

# 81. Gate 0 — v1.2 Production Audit

## 81.1 Vì sao phải audit trước

v1.2 đã deploy. Không được dùng v1.3 để vô tình che lỗi v1.2 bằng abstraction
hoặc feature mới.

Chuỗi audit độc lập:

```text
PROJECT PLAN v1.2
        ↓
CURRENT PRODUCTION CODE
        ↓
SCHEMA / MIGRATIONS
        ↓
TESTS
        ↓
RUNTIME CONFIG
        ↓
PRODUCTION OBSERVATION
```

Audit phải trả lời:

1. M19.0 → M19.10 có thực sự wired vào runtime không?
2. Plan → Code → Test có khớp nhau không?
3. Feature flag, RBAC, audit log, provider policy có enforce thật không?
4. Monitor/observation/event có tạo false state không?
5. EN/VI có hoạt động xuyên route không?
6. Production có blocker P0/P1 nào khiến M20 không nên bắt đầu?

Bổ sung 6 câu hỏi riêng cho v1.3 (nền của M20 nằm ở đây):

```text
7.  search_queries (§67.4) có thật sự log result_count / zero_result /
    clicked_course_id không? Dữ liệu đủ dài để làm baseline chưa?
8.  Vòng lặp zero-result → discovery query / topic tag có đang chạy không?
9.  courses có những field nào thật sự dùng được cho semantic document?
    (skills, learning_outcomes có tồn tại hay không — xem §88.2)
10. ai_analysis_json còn tin được không? tỷ lệ stale bao nhiêu?
11. Postgres hiện tại (Neon) bật được extension nào: vector, unaccent,
    pg_trgm?
12. Hạ tầng queue của M19.4/M19.5 (apps/monitor) có tái dùng được cho
    embedding job không?
```

## 81.2 Audit là read-first, fix-second

Phase A:

```text
AUDIT ONLY
→ không sửa code trong lúc tìm finding
→ xuất evidence matrix: claim ↔ file:line ↔ test ↔ runtime
```

Phase B:

```text
P0/P1 REMEDIATION
→ fix riêng từng finding
→ regression tests
→ quality gates
```

Không được sửa `project-plan-v1.2.md` để hợp thức hóa implementation hiện tại.

## 81.3 Gate A — mở M20

```text
P0 = 0

P1 = 0
hoặc P1 còn lại ghi rõ ACCEPTED_RISK kèm lý do và người chấp nhận

lint PASS
typecheck PASS
test PASS
build PASS

production smoke PASS

monitor/event không có known false-event blocker
RBAC/audit log không có known bypass

§80.2 Precondition Check đã điền đủ số và có kết luận
```

Nếu audit phát hiện schema/data integrity issue, xử lý trước mọi việc liên
quan search.

---

# 82. Non-Goals v1.3

```text
KHÔNG public user account bắt buộc
KHÔNG paid subscription
KHÔNG social/community/review system
KHÔNG chat bot trả lời mọi thứ
KHÔNG AI tự bịa course
KHÔNG AI tự publish/approve
KHÔNG AI thay Truth Engine của v1.2
KHÔNG thay Source Fetching policy
KHÔNG bypass provider bot protection
KHÔNG full-catalog crawler
KHÔNG thay tracker bằng semantic search
KHÔNG redesign toàn bộ UI
KHÔNG recommendation dựa trên sensitive profiling
KHÔNG vector hóa raw HTML hoặc evidence không cần thiết
KHÔNG dùng vector similarity làm "quality score"
KHÔNG thêm vector database độc lập
KHÔNG xây ANN index ở quy mô catalog hiện tại (§88.5)
KHÔNG lấy CTR làm ranking signal trong v1.3 (§90.4)
KHÔNG trả kết quả dưới relevance floor để tránh trang trống (§89.5)
KHÔNG để semantic search làm mất tín hiệu catalog gap của §67.4
KHÔNG thêm top-level category (giữ nguyên quyết định v1.2 §67.2)
```

Public site vẫn phải hoạt động bình thường nếu toàn bộ AI/vector subsystem
chết.

---

# 83. Invariants

## 83.1 Kế thừa từ v1.2 — hard constraints

```text
Provider fetch policy là luật.
NO_FETCH không có ngoại lệ.
course_observations append-only.
BLOCKED/TIMEOUT/ERROR không tạo event.
Không so sánh giá khác observed_region.
AI không publish/approve course.
Chỉ 100% off mới là free.
FREE_TRIAL không vào list free.
Certificate resolver giữ thứ tự authority §66.3.
External content là untrusted input.
Mọi state change phải audit (§77 rule 33).
RBAC enforce server-side.
Auto-approve vẫn bị cấm.
Public route mới phải có EN + VI trong cùng milestone.
Milestone tạo entity mới phải ship admin UI trong cùng milestone (§77 rule 36).
Mọi external call ghi api_usage_log kèm worker_version (§77 rule 31).
Feature mới phải có kill switch, mặc định OFF khi deploy (§77 rule 32).
```

## 83.2 Invariant mới của v1.3

```text
Semantic search KHÔNG override Truth.
  Course semantic-match rất cao nhưng không còn free
  → bị loại khỏi kết quả "free". Không ngoại lệ.

Ranking KHÔNG quyết định eligibility. Truth quyết định.

Trung thực > số kết quả.
  Không có course phù hợp thì nói không có,
  không lấp bằng match yếu (§89.5).

Zero-result là TÍN HIỆU SẢN PHẨM, không phải lỗi cần che.
  Mọi thay đổi retrieval phải bảo toàn tín hiệu catalog gap (§86.3, §89.6).

Query embedding phải cache được. Mỗi search không được là một AI call mới.

Embedding phải versioned. Đổi model không được trộn vector không tương thích.

Semantic failure phải fallback lexical, không trả 500.

AI chỉ được làm query understanding và sequence gợi ý.
  AI không sinh course, certificate, giá, hay kết luận "best".
```

---

# 84. Kiến trúc v1.3

```text
                    User Query
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  Normalizer      Lexical Search   Query Understanding
  (unaccent,           │            (deterministic first,
   trgm, alias)        │             AI chỉ khi cần)
        │              │                  │
        └──────────────┤                  ▼
                       │          Query Embedding Cache
                       │                  │
                       │                  ▼
                       │          Semantic Retrieval
                       │                  │
                       └────────┬─────────┘
                                ▼
                          Hybrid Fusion (RRF)
                                │
                                ▼
                          Truth Filters
                                │
                                ▼
                       Relevance Floor Check
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
           Deterministic Ranking      unmet_intent
                    │                  (log + honest
                    ▼                   empty state
                Results                 + watch CTA)
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
      Similar   Compare   Learning Goal
```

Fail-safe theo tầng:

```text
AI intent parser chết   → dùng raw query + deterministic parsing
Query embedding chết    → lexical-only
Vector store chết       → lexical-only
Lexical chết            → đây mới là sự cố P0
```

Nguyên tắc: **vector/embedding không bao giờ là single point of failure.**

Runtime ownership (bắt buộc chốt, không để Cursor tự chọn):

```text
apps/web       search request path, query embedding cache, fusion, ranking
apps/monitor   embedding backfill + re-embed job (TÁI DÙNG queue của M19.4/M19.5)
               KHÔNG tạo worker mới, KHÔNG chạy backfill trên Vercel serverless
```

---

# 85. Ngưỡng số bắt buộc

v1.2 gate được vì có số (`< 12 giây`, `> 90%`, `junk_rate < 15%`, `0 false
event`). v1.3 phải giữ đúng chuẩn đó. "Tốt hơn có ý nghĩa" không phải gate.

Giá trị dưới đây là **đề xuất khởi điểm**. Phải chốt con số cuối tại M20.0 sau
khi có baseline, và ghi vào `config/search-thresholds.ts` versioned.

| Chỉ số | Ngưỡng | Dùng ở |
|---|---|---|
| NDCG@10 hybrid vs lexical baseline (sau M20.1) | ≥ +15% relative | STOP 1 |
| Precision@5 hybrid | ≥ 0.60 | STOP 1 |
| Exact-title success | ≥ 98% | M20.3, STOP 1 |
| Exact-title regression cho phép | ≤ 1pp | M20.3 |
| VI benchmark NDCG@10 | ≥ 0.80 × điểm EN | M20.1, M20.9 |
| Search p95 end-to-end | ≤ 600 ms | STOP 1, M20.11 |
| Semantic path timeout | 400 ms (rồi fallback) | M20.3 |
| Vector query timeout | 250 ms | M20.3 |
| Query embedding cache hit rate | ≥ 60% | M20.3 |
| Semantic degraded rate | < 2% | M20.10 |
| Hard zero-result rate | < 3% | M20.10 |
| unmet_intent rate | < 8% | M20.10 |
| CATALOG_GAP share của zero-result | báo cáo, gate ở §86.3 | M20.0 |
| Intent parse success | ≥ 95% | M20.5 |
| Fallback-to-raw-query rate | < 5% | M20.5 |
| NL intent calls / ngày (global cap) | 2 000 | M20.5 |
| NL intent calls / IP / giờ | 20 | M20.5 |
| Embedding daily budget | bounded, chốt bằng env | M20.2 |
| Diversity cap — similar courses | ≤ 2 course/provider trong 6 | M20.6 |
| Relevance floor (cosine hoặc fused rank) | chốt bằng data ở M20.3 | M20.3 |
| Learning path steps | 3–7 | M20.8 |
| Compare courses | ≤ 3 | M20.7 |

Quy tắc: **mọi gate trong tài liệu này phải trỏ về một dòng ở bảng trên.** Gate
không có số thì không phải gate.

---

# 86. M20.0 — Foundation, Baseline & Intent Diagnosis

## 86.1 Mục tiêu

Đo sản phẩm đang chạy **trước** khi thay search. Không milestone nào sau đây
được bắt đầu mà không có baseline.

## 86.2 Baseline — tái dùng instrumentation đã có

v1.2 `§67.4` đã ALTER `search_queries` với `result_count`, `zero_result`,
`clicked_course_id`. **Không dựng lại pipeline analytics mới.** Mở rộng cái
đang có.

Baseline cần xuất:

```text
search requests/day
% session có dùng search
zero-result rate
search latency p50/p95
outbound CTR từ search
search → course detail CTR
course detail → outbound CTR
top 100 queries + tần suất
query language VI/EN (và VI-không-dấu)
filter usage
provider distribution trong kết quả click
category distribution
stale result rate
```

Privacy: không log raw query nếu có rủi ro không cần thiết; dùng normalized
query + hash, retention bounded, và tuân §98.2.

## 86.3 Intent Diagnosis — gate quan trọng nhất của M20.0

Phân loại toàn bộ zero-result và low-CTR query trong 90 ngày gần nhất:

```text
RETRIEVAL_MISS
  course PHÙ HỢP có trong catalog nhưng search không trả ra
  → semantic/hybrid sẽ giải quyết được

CATALOG_GAP
  không có course nào trong catalog thỏa query
  → embedding không giải được. Đây là bài toán COVERAGE.

CONSTRAINT_GAP
  có course đúng chủ đề nhưng không thỏa constraint
  (thời lượng, certificate, level, ngôn ngữ)
  → một phần là metadata completeness, không phải retrieval

JUNK / NON_INTENT
  query rác, bot, test
```

Cách làm: lấy mẫu ≥ 150 query (ưu tiên theo tần suất), 2 người đối chiếu tay
với catalog, thời lượng ước tính **2 người × 4 giờ**.

Gate quyết định:

```text
CATALOG_GAP ≥ 50%
  → v1.3 SAI TRỤC ở thời điểm này
  → chuyển ngân sách sang COVERAGE (mở provider theo v1.2 §68,
    nâng DISCOVERY_QUERY_LIMIT, dùng lại vòng lặp §67.4)
  → giữ lại M20.0 + M20.1 (lexical upgrade, rẻ) và hoãn M20.2+

CATALOG_GAP 25–50%
  → chạy v1.3 nhưng song song một luồng coverage
  → scope giảm: bỏ hoặc hoãn M20.8 Learning Path

CATALOG_GAP < 25%
  → v1.3 đúng trục, chạy full scope
```

## 86.4 Search evaluation dataset

Benchmark tối thiểu **60 query**, mục tiêu **100**.

Nhóm:

```text
Exact title:
  CS50
  Google Data Analytics

Keyword EN:
  python beginner
  azure fundamentals

Keyword VI có dấu:
  khóa học python cho người mới

Keyword VI KHÔNG dấu:          ← nhóm bị bỏ sót ở bản nháp
  khoa hoc python mien phi
  power bi co ban

Natural language EN:
  free beginner AI course without coding

Natural language VI:
  khóa học AI cho PM không cần biết lập trình

Constraint-heavy:
  python beginner under 3 hours with certificate

Cross-language:
  quản lý dự án                → Project Management
  trí tuệ nhân tạo cho người mới → AI for Beginners

Negative / cần trả rỗng trung thực:
  khóa học kế toán thuế Việt Nam nâng cao   ← nếu catalog không có
```

Label:

```text
graded relevance 0–3 (không phải nhị phân — NDCG cần graded)
label cho top-10 của UNION các retrieval mode
2 người label độc lập, chốt bất đồng bằng thảo luận
ghi inter-annotator agreement
```

Chi phí label thực tế phải ghi vào plan: **~60 query × 10 kết quả × 2 người**.
v1.2 `§79.5` đã xác định operator là nút thắt — không được coi việc label là
miễn phí.

## 86.5 Chống label rot

Đây là tracker: course "relevant" hôm nay có thể hết free tuần sau. Label sẽ
mục.

```text
dataset neo vào catalog snapshot
  snapshot_id + snapshot_at + course_ids có mặt lúc label

label chỉ chấm ĐỘ PHÙ HỢP CHỦ ĐỀ (topical relevance)
  KHÔNG chấm eligibility — eligibility do Truth Filter lo

khi benchmark chạy lại:
  course đã unpublish/hết free → loại khỏi cả expected set và kết quả
  ghi rõ "N/60 query bị suy giảm label"
  label decay > 20% → phải re-label trước khi dùng cho gate
```

## 86.6 Gate M20.0

```text
baseline report tồn tại và có đủ số của §80.2
Intent Diagnosis xong + kết luận theo §86.3
evaluation dataset ≥ 60 query, versioned, neo catalog snapshot
inter-annotator agreement được ghi
current keyword search benchmarked (đây là baseline để so)
bảng ngưỡng §85 đã chốt số cuối và commit vào config
admin UI: benchmark runner + xem kết quả run (rule 36)
lint / typecheck / test / build PASS
```

---

# 87. M20.1 — Lexical Relevance Upgrade

## 87.1 Vì sao milestone này đứng trước semantic

Postgres **không có text-search dictionary cho tiếng Việt**. Người dùng Việt gõ
không dấu liên tục. Rất có thể một phần lớn "VI query quality" cải thiện được
mà không cần bất kỳ embedding nào — bằng extension có sẵn, deterministic, gần
như miễn phí, không thêm chi phí vận hành.

```text
Làm cái rẻ trước. Nếu nó đóng được khoảng cách,
ngân sách semantic được đánh giá lại chứ không mặc định chi.
```

## 87.2 Nội dung

```text
unaccent           → tìm không dấu = có dấu ("khoa hoc" ≡ "khóa học")
pg_trgm            → typo tolerance + similarity fallback
weighted tsvector  → title > topic_tags > short_description > description
provider alias map → "MS Learn" ≡ "Microsoft Learn"
query normalizer   → lowercase, unaccent, trim, dedupe token
stopword VI/EN tối thiểu, có test
```

Dùng lại `topic_tags` / `course_topic_tags` của v1.2 `§67.3` làm field lexical
hạng hai — dữ liệu đã có, chưa dùng hết.

## 87.3 Gate M20.1

```text
extension bật được trên Neon (đã xác nhận ở §81.1 câu 11)
VI-không-dấu benchmark: từ ____ → ≥ 0.80 × điểm EN (§85)
exact-title success ≥ 98%, không regression > 1pp
p95 không xấu hơn baseline
tests: unaccent, trgm, alias, weighted rank fixtures
lint / typecheck / test / build PASS
```

Báo cáo bắt buộc sau M20.1:

```text
"Lexical upgrade đã đóng ___% khoảng cách NDCG so với mục tiêu."
→ nếu ≥ 70%, xem xét giảm scope semantic xuống chỉ NL query
```

---

# 88. M20.2 — Semantic Search Foundation

## 88.1 Mục tiêu

Cho phép tìm theo **ý nghĩa**, cho những query mà lexical (đã nâng ở M20.1) vẫn
không giải được.

## 88.2 Semantic document — phải khớp schema thật

Không embedding raw HTML.

Trước khi code, chốt bảng mapping (kết quả audit §81.1 câu 9):

```text
field mong muốn          nguồn thật trong repo            trạng thái
----------------------------------------------------------------------
title                    courses.title                    CÓ
provider                 providers.name                    CÓ
canonical category       categories                        CÓ
topic tags               course_topic_tags (v1.2 §67.3)    CÓ
level                    courses.level                     CÓ
duration                 courses.duration_minutes          CÓ
language                 courses.language                  CÓ
free/cert metadata       price_type, certificate_type,     CÓ
                         free_durability (v1.2 §66.5)
summary                  ai_analysis_json.summary_vi       AI-DERIVED
why_learn                ai_analysis_json.why_learn        AI-DERIVED
skills                   —                                 CHƯA CÓ
learning outcomes        —                                 CHƯA CÓ
```

Quyết định bắt buộc (bản nháp trước tự mâu thuẫn ở đây — vừa liệt kê `summary`,
`skills`, `learning outcomes`, vừa cấm "arbitrary AI chain output"):

```text
Field CHƯA CÓ (skills, learning outcomes)
  → KHÔNG đưa vào semantic document ở M20.2
  → nếu muốn có, đó là milestone data-enrichment riêng, không nhét vào đây

Field AI-DERIVED (summary_vi, why_learn)
  → ĐƯỢC dùng, nhưng có điều kiện:
      • chỉ dùng field đã qua Zod schema của §18
      • đánh dấu nguồn AI_DERIVED trong semantic document builder
      • semantic_document_version PHẢI bump khi course được AI re-analyze
      • có flag EMBED_AI_DERIVED_FIELDS để tắt và đo A/B
  → "arbitrary AI chain output" bị cấm nghĩa là: output chưa validate,
    chưa versioned, hoặc chain nhiều tầng. Không phải cấm mọi AI field.
```

Tuyệt đối không đưa vào:

```text
raw fetched HTML
audit logs
internal evidence dump
secret/internal metadata
ai_score / quality_score / confidence (số nội bộ)
```

## 88.3 Chọn embedding model — multilingual là tiêu chí ở ĐÂY

Bản nháp trước chọn model ở milestone này nhưng chỉ đặt yêu cầu multilingual ở
milestone cross-language cuối cùng. Đó là lỗi thứ tự: sẽ phải re-embed toàn bộ
catalog.

Tiêu chí chọn, đánh giá cùng lúc:

```text
1. multilingual VI ↔ EN               ← BẮT BUỘC, không phải nice-to-have
2. benchmark trên §86.4 dataset (cả nhóm VI không dấu)
3. dimension vs cost lưu trữ
4. giá / 1M token input
5. rate limit và độ ổn định
6. có sẵn qua AIProvider abstraction (v1.1 §6) hay phải thêm provider mới
7. rủi ro deprecate (§107)
```

Provider: v1.1 chỉ định `AIProvider` = NVIDIA NIM. NIM **chưa được xác nhận** có
embedding model multilingual phù hợp. Vì vậy:

```text
tạo EmbeddingProvider abstraction RIÊNG, không nhét vào AIProvider
  → generate(texts[]) → vectors[]
  → đổi provider không sửa business layer
so sánh ≥ 2 ứng viên bằng cùng dataset trước khi chốt
ghi quyết định vào ADR ngắn kèm số benchmark
```

## 88.4 Embedding lifecycle

```text
Course publish/update  (hoặc AI re-analyze)
      ↓
Semantic document builder
      ↓
Content hash (chỉ trên field đã chọn ở §88.2)
      ↓
Hash changed?
   ├─ NO  → skip
   └─ YES → enqueue (queue của M19.4/M19.5)
              ↓
            embedding (batched, bounded)
              ↓
            vector store
              ↓
            api_usage_log + worker_version   (§77 rule 31)
```

Backfill phải bounded, batched, idempotent, resume được.

## 88.5 Storage — cố tình giữ đơn giản

```text
pgvector trên Postgres/Neon hiện tại
KHÔNG thêm vector database độc lập
KHÔNG xây ANN index (HNSW/IVFFlat) ở quy mô này
```

Lý do: ở 200–1 000 course, brute-force cosine trong Postgres là tức thời. Thêm
ANN index chỉ thêm tham số phải tune, thêm cách sai âm thầm, không thêm tốc độ
người dùng cảm nhận được.

Ngưỡng mở lại quyết định: `> 20 000 course` hoặc `vector query p95 > 250ms`.

## 88.6 Versioning

Lưu bắt buộc:

```text
embedding_model
embedding_version
semantic_document_version
content_hash
embedded_at
status
last_error
```

Query chỉ đọc vector có `(embedding_model, embedding_version)` khớp version
đang active. Mixed-version không được trộn im lặng.

## 88.7 Gate M20.2

```text
bảng mapping §88.2 đã chốt và commit
ADR chọn embedding model có số benchmark, có kết quả VI
EmbeddingProvider abstraction có ≥ 1 implementation + 1 fake cho test
backfill idempotent (chạy 2 lần → 0 embedding call thêm)
changed course re-embed / unchanged course skip
failed embedding KHÔNG làm course biến mất khỏi lexical search
mixed-version không bị trộn (có test)
FEATURE_SEMANTIC_SEARCH flag, mặc định OFF
api_usage_log ghi đủ mọi embedding call
cost thực tế của full backfill được đo và báo cáo (USD)
admin UI: embedding queue depth / failed / stale / trigger re-embed (rule 36)
lint / typecheck / test / build PASS
```

---

# 89. M20.3 — Hybrid Search

## 89.1 Không thay keyword bằng vector

Hai retrieval path song song, rồi fusion:

```text
Lexical (đã nâng ở M20.1)
Semantic (M20.2)
```

Exact title/provider query phải tiếp tục mạnh — đây là loại query có ý định rõ
nhất và ít khoan dung nhất.

## 89.2 Fusion

```text
RRF (Reciprocal Rank Fusion) hoặc equivalent
deterministic, explainable, testable
KHÔNG magic weight rải rác trong code
toàn bộ tham số trong config/search-ranking.ts, versioned
mọi thay đổi config phải kèm benchmark run
```

## 89.3 Query embedding cache — đây mới là trục chi phí thật

Bản nháp trước bound chi phí document embedding. Nhưng 300 course = embed một
lần. **Chi phí thật là mỗi lần search = 1 embedding call**, cộng 100–300ms vào
p95.

```text
cache key   = hash(normalized_query + embedding_model + embedding_version)
store       = Postgres table hoặc KV, TTL 30 ngày
top query lặp rất nhiều (§86.2 đã đo) → hit rate mục tiêu ≥ 60%
miss + timeout 400ms → bỏ semantic path, chạy lexical-only
```

## 89.4 Truth filtering

Trước khi ra public result, luôn lọc:

```text
publication status
free eligibility
staleness policy
provider policy
visibility
locale/content availability
```

Semantic relevance **không bao giờ** bypass các filter này. Có regression test
riêng: course match cosine cao nhất nhưng `price_type = PAID` → phải không xuất
hiện trong list free.

## 89.5 Relevance floor — trung thực hơn là lấp đầy

```text
Kết quả dưới relevance floor KHÔNG được trả như kết quả bình thường.

Thay vào đó:
  empty state trung thực
  "Chưa có khóa học miễn phí phù hợp với yêu cầu này."
  + CTA tạo watch (dùng course_watches / alert của v1.2 §72)
  + gợi ý nới constraint nào (bỏ certificate? tăng thời lượng?)
```

Sản phẩm này bán sự trung thực (Principle 1: free status > số lượng course).
Trả 6 course hơi liên quan để tránh trang trống là phá đúng thứ đang tạo ra
niềm tin.

Floor chốt bằng data ở M20.3: lấy phân bố score của cặp đã label 0 vs ≥ 2.

## 89.6 Bảo toàn tín hiệu catalog gap

Rủi ro âm thầm: semantic search làm `zero_result` giảm → vòng lặp
`zero-result → discovery query / topic tag` của v1.2 `§67.4` **tắt**, trong khi
lỗ hổng catalog vẫn còn nguyên, chỉ bị che.

Bắt buộc:

```text
ALTER search_queries:
  + retrieval_mode        LEXICAL | SEMANTIC | HYBRID
  + degraded              boolean
  + latency_ms
  + top_score
  + unmet_intent          boolean  ← không có kết quả trên floor
  + lexical_would_be_zero boolean  ← lexical-only sẽ trả 0

Admin queue của §67.4 chuyển sang đọc unmet_intent
  (KHÔNG chỉ đọc zero_result)

Dashboard phải hiện: unmet_intent theo tuần, top unmet query
```

## 89.7 Fallback

```text
vector timeout / error / flag OFF
→ lexical-only
→ degraded = true, log + metric
→ KHÔNG trả 500 nếu lexical còn dùng được
→ UI không hiện thông báo kỹ thuật cho user
```

## 89.8 Gate M20.3

```text
hybrid không làm exact-title benchmark xấu hơn > 1pp so với M20.1
p95 ≤ 600ms end-to-end, semantic path timeout 400ms có test
query embedding cache hit ≥ 60% trên top-100 query
relevance floor có số cụ thể + fixture test
truth-filter regression test PASS (cosine cao + PAID → loại)
unmet_intent + lexical_would_be_zero được ghi đúng (test)
vector outage test: subsystem OFF → search vẫn dùng được
lint / typecheck / test / build PASS
```

---

# 90. M20.4 — Smart Ranking & Relevance

## 90.1 Ranking signals

Được dùng:

```text
query relevance (fused rank)
exact phrase/title match
semantic similarity
topic/category match
free_durability          (PERMANENT > AUDIT_FOREVER > LIMITED)
verification freshness   (last_verified_at)
source/provider trust
metadata completeness
certificate intent match
duration intent match
level intent match
```

Không được dùng:

```text
AI subjective quality score
ai_score / quality_score làm ranking chính
provider popularity giả định
paid promotion
random boost
CTR (xem §90.4)
```

## 90.2 Ranking ≠ Truth

```text
Truth   → course có ĐƯỢC XUẤT HIỆN không
Ranking → thứ tự TRONG tập hợp đã hợp lệ
```

Không có đường nào để ranking đưa một course không eligible lên trang.

## 90.3 Explainability

Không public "score 92.3". Nhưng internal debug bắt buộc có reason codes:

```text
EXACT_TITLE_MATCH
SEMANTIC_MATCH
TOPIC_MATCH
RECENTLY_VERIFIED
DURABLE_FREE
CERTIFICATE_MATCH
DURATION_MATCH
LEVEL_MATCH
LEXICAL_ONLY_DEGRADED
```

Reason code là nguồn cho "search reason chips" ở §102 — chip phải map 1:1 với
reason code, không viết text tự do.

## 90.4 Anti-feedback-loop

```text
CTR được QUAN SÁT, không trở thành ranking signal trong v1.3.
```

Lý do: catalog nhỏ + traffic nhỏ → CTR nhiễu nặng, và course đang top sẽ càng
top chỉ vì đang top. Muốn dùng CTR thì phải có position-bias correction, đó là
việc của v1.4 trở lên.

## 90.5 Gate M20.4

```text
ranking config centralized + versioned
mỗi signal có unit test riêng
thay đổi config → benchmark run tự động, diff NDCG được ghi
reason codes có test
không có signal nào đọc CTR (test tĩnh / lint rule)
lint / typecheck / test / build PASS
```

---

# 91. STOP GATE #1 — Search Quality

Sau M20.0 → M20.4. **Không chạy tiếp M20.5+ chỉ vì gate xanh.**

So sánh 4 chế độ (bản nháp trước chỉ so 3 — thiếu lexical đã nâng, tức là so
với baseline yếu và sẽ tự khen mình):

```text
LEXICAL BASELINE   (trước M20.1)
LEXICAL UPGRADED   (sau M20.1)
SEMANTIC ONLY
HYBRID
```

Đo:

```text
NDCG@10
Precision@5
zero-result / unmet_intent rate
latency p50/p95
exact-title success
VI có dấu / VI không dấu / EN riêng biệt
cost per 1 000 search
```

Quyết định:

```text
HYBRID ≥ +15% NDCG@10 so với LEXICAL UPGRADED, p95 ≤ 600ms
  → tiếp tục M20.5+

HYBRID cải thiện nhưng < +15%
  → giữ hybrid ở flag nội bộ
  → KHÔNG xây NL Finder / Learning Path lên trên
  → quay lại sửa semantic document hoặc đổi model

SEMANTIC không cải thiện, hoặc latency/cost vượt ngưỡng
  → giữ LEXICAL UPGRADED làm production
  → ghi nhận: v1.3 kết thúc ở M20.4, phần còn lại hủy
  → đây là kết cục CHẤP NHẬN ĐƯỢC, không phải thất bại
```

---

# 92. M20.5 — Natural Language Course Finder

## 92.1 Mục tiêu

```text
"Tôi là PM, muốn học AI nhưng không biết code,
 mỗi ngày có khoảng 30 phút."
```

→ structured intent → hybrid search → truth filter → ranking → course thật.

## 92.2 Deterministic trước, AI sau

```text
Bước 1  deterministic parsing
        số + đơn vị thời gian, "có chứng chỉ", "cho người mới",
        tên provider, tên topic khớp topic_tags
        → nếu đã đủ constraint, KHÔNG gọi AI

Bước 2  chỉ khi bước 1 không đủ → AI intent parser
```

`§108 rule 21`: không gọi AI khi deterministic đủ. Đây là guard chi phí lớn
nhất của milestone này.

## 92.3 Intent schema

```text
topics[]
goal
level
coding_requirement
duration_preference
certificate_preference
language_preference
free_requirement
provider_preference[]
```

Validate bằng Zod. Unknown enum value → drop field đó, không fail cả request.
AI **không** trả danh sách course.

## 92.4 Abuse & cost — design tại đây, không để tới hardening

v1.3 không có account (§82). Nghĩa là NL Finder là một **AI endpoint mở**. Đây
là bề mặt cost-amplification rõ nhất của cả v1.3.

```text
rate limit theo IP           20 call/giờ (§85)
global daily cap             2 000 call/ngày
intent cache                 hash(normalized_query) → intent, TTL 7 ngày
query length cap             512 ký tự
hết budget                   → degrade sang hybrid search với raw query
                               (KHÔNG hiện lỗi, KHÔNG trả rỗng)
kill switch                  FEATURE_NL_COURSE_FINDER
```

## 92.5 Guardrails

```text
user text là DATA, không phải instruction (prompt injection)
structured output validate chặt
invalid output → fallback raw query, log, không retry vô hạn (max 1 retry, §18)
không lưu inferred personal characteristics thành profile bền (§98.2)
```

## 92.6 Gate M20.5

```text
intent parse success ≥ 95% trên nhóm NL của §86.4
fallback-to-raw-query < 5%
intent cache hit được đo
rate limit + global cap có integration test
prompt injection fixture test (≥ 10 payload)
AI OFF → NL input vẫn chạy như hybrid search bình thường
api_usage_log đủ cho mọi AI call
admin UI: NL usage, budget còn lại, invalid-output log (rule 36)
EN + VI cùng milestone
lint / typecheck / test / build PASS
```

---

# 93. M20.6 — Similar / Related Courses

## 93.1 Candidate rules

Course Detail có "Similar free courses". Candidate phải:

```text
published
eligible (truth-valid)
không phải course hiện tại
không expired
không hidden
trên relevance floor (§89.5)
```

Thiếu candidate hợp lệ → **không hiện section**, không lấp bằng course yếu.

## 93.2 Diversity

```text
≤ 2 course cùng provider trong 6 (§85)
≤ 3 course cùng topic tag chính
không hiện 2 course gần trùng title
```

## 93.3 Fallback

```text
semantic unavailable
→ related theo topic_tags → category → provider
→ vẫn áp diversity cap và truth filter
```

## 93.4 Gate

```text
0 course không eligible xuất hiện (test)
diversity cap có test
semantic OFF → fallback hoạt động
EN + VI
```

---

# 94. M20.7 — Course Comparison

## 94.1 Scope

So sánh ≤ 3 course. Fields:

```text
provider
free type
free_durability
certificate
level
duration
language
skills/topics
last_verified_at
verification freshness
```

## 94.2 Không AI phán "best"

Hệ thống chỉ nói câu deterministic, dẫn được về field:

```text
"Ngắn nhất"                    ← duration_minutes
"Có chứng chỉ miễn phí"        ← certificate_type
"Được kiểm gần đây nhất"       ← last_verified_at
"Miễn phí bền hơn"             ← free_durability
"Phù hợp người mới"            ← level
```

Không có câu nào dạng "khóa tốt nhất" nếu không có evidence field đứng sau.

## 94.3 URL

Shareable bằng URL nếu implementation đơn giản và an toàn (`?compare=slug-a,
slug-b`). Không cần account. Không index (§103).

## 94.4 Gate

```text
≤ 3 course enforce server-side
course không eligible không vào compare được
0 câu subjective (snapshot test toàn bộ copy)
EN + VI
```

---

# 95. M20.8 — Learning Goal / Path Builder

> Milestone này bị hoãn nếu `CATALOG_GAP` ở §86.3 rơi vào 25–50%.
> Path nhiều bước cần mật độ catalog cao hơn search một khóa.

## 95.1 Mục tiêu

```text
"Tôi muốn học Data Analyst từ số 0"
→ learning structure → map sang course THẬT
```

## 95.2 AI authority boundary

```text
AI ĐƯỢC:      đề xuất sequence kỹ năng/chủ đề
AI KHÔNG ĐƯỢC: invent course, invent certificate, invent giá, override truth
```

## 95.3 Pipeline

```text
Goal
 ↓
Skill/topic sequence (3–7 step)
 ↓
Validate từng step khớp taxonomy thật (categories / topic_tags)
 ↓  step không map được → bỏ step, ghi log, KHÔNG bịa
Search từng step (hybrid + truth filter)
 ↓
Chọn course eligible
 ↓  step không có course → hiện "chưa có khóa phù hợp" + CTA watch
Build shareable path
```

## 95.4 MVP scope

Không có:

```text
progress tracking
account sync
streak
gamification
personal learning history
```

Path là **discovery artifact**, không phải LMS.

## 95.5 Gate

```text
100% course trong path tồn tại trong catalog và eligible (test)
step không map taxonomy → bị loại, không bịa
path có step rỗng vẫn render trung thực
3–7 step enforce
EN + VI
```

---

# 96. M20.9 — Cross-Language VI ↔ EN Search

## 96.1 Mục tiêu

```text
"quản lý dự án"                → Project Management
"trí tuệ nhân tạo cho người mới" → AI for Beginners
"khoa hoc power bi mien phi"     → Power BI (không dấu, đã có từ M20.1)
```

Milestone này **không chọn lại model** — model multilingual đã được chốt ở
M20.2 `§88.3`. Ở đây chỉ đo, tune và đóng khoảng cách còn lại.

## 96.2 Không dịch title giả

```text
official title giữ nguyên
localized summary/UI hỗ trợ hiểu, không thay title
không thêm translation call cho mọi query nếu embedding đã đủ
```

## 96.3 Gate

```text
VI benchmark NDCG@10 ≥ 0.80 × điểm EN (§85)
VI không dấu không xấu hơn VI có dấu > 5%
không tuyên bố cross-language tốt dựa trên vài demo query
cost không tăng > 10% so với M20.3
```

---

# 97. STOP GATE #2 — Product Discovery Validation

Sau M20.5 → M20.9. Test 10 journey:

```text
A. exact course title
B. keyword EN
C. keyword VI không dấu
D. Vietnamese natural language
E. English natural language
F. certificate constraint
G. duration constraint
H. similar courses
I. compare
J. learning goal
K. query KHÔNG có đáp án → phải rỗng trung thực + CTA watch
```

Human review top-5 cho toàn bộ benchmark quan trọng.

Quyết định theo từng feature, **flag độc lập**, không all-or-nothing:

```text
FEATURE_SEMANTIC_SEARCH
FEATURE_HYBRID_SEARCH
FEATURE_NL_COURSE_FINDER
FEATURE_SIMILAR_COURSES
FEATURE_COURSE_COMPARE
FEATURE_LEARNING_PATHS
FEATURE_CROSS_LANGUAGE
```

```text
UI đẹp nhưng retrieval kém → KHÔNG deploy feature đó
Feature nào không đạt gate riêng thì ở lại OFF, phần còn lại vẫn release
```

---

# 98. M20.10 — Discovery Analytics & Evaluation

## 98.1 Metrics

```text
SEARCH
  hard zero-result rate
  unmet_intent rate                    ← tín hiệu catalog gap (§89.6)
  lexical fallback rate
  semantic degraded rate
  search latency p50/p95
  search → detail CTR
  outbound CTR từ search

QUALITY
  NDCG@10 / Precision@5 (theo dataset version)
  exact-title success
  constraint satisfaction rate
  VI có dấu / VI không dấu / EN riêng biệt
  label decay % của dataset            ← §86.5

AI
  intent parse success
  invalid structured output
  fallback-to-raw-query rate
  intent cache hit rate
  token/cost per query
  budget consumed % / ngày

VECTOR
  embedding queue depth
  failed embeddings
  stale embeddings (hash mismatch)
  re-embed count
  vector query latency
  query embedding cache hit rate
  chi phí embedding / tháng (USD thật)
```

Mỗi con số trên dashboard phải click được vào đúng filter (v1.2 `§77 rule 37`).

## 98.2 Privacy

```text
không xây behavioral profile bền trong v1.3
NL query: lưu normalized + hash, không lưu raw nếu không cần
inferred personal characteristics (nghề, trình độ) chỉ tồn tại trong
  request scope, không persist
retention bounded, ghi rõ số ngày
analytics phục vụ quality/product metric, không tạo hồ sơ nhạy cảm
```

## 98.3 Gate

```text
benchmark chạy được bằng một command, kết quả lưu versioned
regression alert: NDCG giảm > 5% giữa 2 run → fail CI
dashboard đủ để rollback trong < 15 phút
label decay được báo cáo tự động
```

---

# 99. M20.11 — v1.3 Production Hardening

## 99.1 Reliability

Test chủ động từng kịch bản:

```text
vector store unavailable
embedding provider unavailable / rate-limited
AI intent parser unavailable
query embedding cache miss + timeout
DB slow
search timeout
mixed-version embeddings
stale embedding
course deleted / unpublished giữa lúc search
feature flag rollback từng cái
toàn bộ AI/vector OFF cùng lúc
```

## 99.2 Security

```text
RBAC (search debug endpoint là admin-only)
admin debug endpoints
prompt injection (NL Finder, Learning Path)
SQL injection (query normalizer, tsquery building)
XSS (query echo lại trên trang kết quả)
open redirect (outbound + compare URL)
SSRF regression
secret handling (embedding API key)
rate limits (IP + global)
abuse / cost amplification
```

```text
Semantic search KHÔNG được trở thành embedding proxy công khai.
Không có endpoint nào nhận text tự do rồi trả vector.
```

## 99.3 Cost guards

```text
embedding batch size
embedding concurrency
daily embedding budget
NL intent daily cap + per-IP cap
query embedding cache TTL
query timeout
vector result count (top-K)
```

```text
Không gọi AI khi deterministic parsing đủ.
Không gọi embedding khi cache hit.
Vượt budget → degrade, không lỗi.
```

## 99.4 Deployment

Staged theo flag, mỗi bước quan sát ≥ 48h:

```text
1. lexical upgrade (M20.1)        ← không cần flag, deploy sớm nhất
2. embeddings/backfill (OFF ở read path)
3. internal evaluation only
4. hybrid search — 10% exposure
5. hybrid search — 100%
6. NL finder
7. similar / compare
8. learning paths
9. cross-language tuning
```

**Không bật nhiều bước cùng lúc.** Mỗi bước phải có metric so sánh trước/sau.

---

# 100. Data Model — Conceptual Additions

Tên bảng/field phải adapt theo schema thực tế sau audit `§81`.

```text
KHÔNG tạo entity mới nếu repo đã có equivalent.
```

## 100.1 Bảng mới

```text
course_embeddings
  course_id
  embedding                  vector
  embedding_model
  embedding_version
  semantic_document_version
  content_hash
  embedded_at
  status                     PENDING | OK | FAILED | STALE
  last_error

query_embedding_cache        (hoặc KV tương đương)
  query_hash
  embedding_model
  embedding_version
  embedding
  hit_count
  created_at
  last_used_at

search_evaluations
  dataset_version
  catalog_snapshot_id        ← chống label rot (§86.5)
  query_id
  locale                     EN | VI | VI_NO_DIACRITIC
  query_group                EXACT | KEYWORD | NL | CONSTRAINT | CROSS_LANG | NEGATIVE
  query_text_or_safe_ref
  expected_labels            course_id → grade 0..3
  annotator_agreement
  created_at

search_benchmark_runs
  run_id
  dataset_version
  retrieval_mode
  ranking_config_version
  embedding_model
  ndcg_at_10
  precision_at_5
  exact_title_success
  latency_p95
  cost_estimate
  created_at
```

## 100.2 Mở rộng bảng đã có — không tạo trùng

```text
ALTER search_queries          (đã có từ v1.2 §67.4 — MỞ RỘNG, không tạo mới)
  + retrieval_mode
  + degraded
  + latency_ms
  + top_score
  + unmet_intent
  + lexical_would_be_zero
  + ranking_config_version

ALTER courses                 (append-only theo v1.2 Rule 10)
  + semantic_indexed_at       nullable
```

`api_usage_log` (v1.2 M19.5) dùng lại cho embedding + intent call. Không tạo
log riêng.

---

# 101. API / Service Boundaries

Conceptual services (không bắt buộc đúng tên class):

```text
QueryNormalizer            unaccent, trgm prep, alias
LexicalSearchService
SemanticDocumentBuilder
EmbeddingProvider          abstraction riêng, KHÔNG nhét vào AIProvider
QueryEmbeddingCache
VectorCourseRepository
SemanticSearchService
HybridSearchService        fusion + relevance floor
TruthFilterService         dùng lại rule v1.2, KHÔNG viết lại
QueryIntentParser          deterministic → AI fallback
CourseRankingService
RelatedCourseService
CourseComparisonService
LearningPathService
SearchEvaluationService
```

Nguyên tắc:

```text
reuse existing architecture (fetcher, queue, audit log, RBAC, i18n)
avoid duplicate search stacks
avoid giant generic framework
keep domain rules outside route handlers
TruthFilter là một chỗ duy nhất, mọi surface đi qua nó
```

---

# 102. UI/UX v1.3

Không redesign toàn site. Bổ sung có kiểm soát:

```text
search input tự nhiên — user KHÔNG cần hiểu chữ "semantic"
natural-language search (cùng một ô input, không tab riêng)
similar courses (Course Detail)
compare action (≤ 3)
learning goal entry
search reason chips — map 1:1 với reason code §90.3
empty state trung thực + CTA watch (§89.5)
degraded mode: im lặng, không hiện lỗi kỹ thuật
```

Không hiển thị:

```text
vector score
cosine similarity
AI confidence raw
embedding model
internal ranking score
```

Giữ ràng buộc v1.2: card ≤ 3 badge (`§77 rule 29`). Reason chip **không** tính
là badge nhưng cũng ≤ 2 chip/card.

```text
Public language: EN + VI trong cùng milestone.
Mobile-first.
```

---

# 103. SEO

```text
search result page: noindex mọi query URL
KHÔNG tạo vô hạn thin/duplicate search URL
compare URL: noindex (nội dung phái sinh, dễ trùng)

Learning Path chỉ index khi:
  content đủ giá trị (≥ 3 step có course thật)
  stable / shareable
  không chứa personal/private input
  qua ngưỡng thin content như M17

Canonical/hreflang giữ đúng EN/VI.
Không để AI-generated thin text tạo SEO spam.
```

Topic page (v1.2 `§67.3`, ngưỡng ≥ 8 course) vẫn là bề mặt SEO chính, không
phải search page.

---

# 104. Env Variables mới

```bash
# Search / lexical
SEARCH_THRESHOLDS_VERSION=
SEARCH_RANKING_CONFIG_VERSION=
SEARCH_P95_BUDGET_MS=600

# Embedding
EMBEDDING_PROVIDER=
EMBEDDING_MODEL=
EMBEDDING_VERSION=
EMBEDDING_DIMENSION=
EMBEDDING_BATCH_SIZE=
EMBEDDING_CONCURRENCY=
EMBEDDING_DAILY_BUDGET_TOKENS=
EMBEDDING_DAILY_BUDGET_USD=
EMBEDDING_QUERY_TIMEOUT_MS=400
EMBED_AI_DERIVED_FIELDS=false

# Vector
VECTOR_QUERY_TIMEOUT_MS=250
VECTOR_TOP_K=50
QUERY_EMBEDDING_CACHE_TTL_DAYS=30

# NL intent
NL_INTENT_DAILY_CALLS=2000
NL_INTENT_PER_IP_HOURLY=20
NL_INTENT_MAX_QUERY_CHARS=512
NL_INTENT_CACHE_TTL_DAYS=7

# Relevance
RELEVANCE_FLOOR=
SIMILAR_MAX_PER_PROVIDER=2
LEARNING_PATH_MIN_STEPS=3
LEARNING_PATH_MAX_STEPS=7

# Feature flags — mặc định OFF khi deploy
FEATURE_SEMANTIC_SEARCH=false
FEATURE_HYBRID_SEARCH=false
FEATURE_NL_COURSE_FINDER=false
FEATURE_SIMILAR_COURSES=false
FEATURE_COURSE_COMPARE=false
FEATURE_LEARNING_PATHS=false
FEATURE_CROSS_LANGUAGE=false
```

Validate bằng Zod như cũ. Thiếu env → fail fast ở boot, không degrade âm thầm.

---

# 105. Testing Strategy

Mỗi milestone vẫn chạy:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

Bổ sung:

```text
query normalizer tests (unaccent, trgm, alias, stopword)
ranking fixture tests
hybrid fusion tests (RRF determinism)
exact-title regression
truth-filter regression (cosine cao + không eligible → loại)
relevance floor tests
unmet_intent / lexical_would_be_zero tests
VI có dấu + VI không dấu search tests
AI structured-output tests (valid, invalid, injection)
intent cache tests
fallback tests từng tầng (§84)
vector outage tests
mixed-version embedding tests
cost-budget tests (vượt budget → degrade, không lỗi)
benchmark regression trong CI (NDCG giảm > 5% → fail)
```

Critical invariant, test riêng, chạy mọi CI:

```text
Toàn bộ semantic/AI subsystem OFF
→ core site + lexical search vẫn usable
→ 0 lỗi 500
→ Course Detail vẫn render đủ (không có similar section là OK)
```

---

# 106. Thứ tự triển khai

```text
GATE 0   §80.2 Precondition Check  +  §81 v1.2 Production Audit + Remediation
```

### GATE A — bắt buộc

```text
P0 = 0
P1 = 0 hoặc accepted risk
production smoke PASS
quality gates PASS
Precondition Check có kết luận "v1.3 đúng trục"
```

Sau đó:

```text
M20.0  Foundation, Baseline & Intent Diagnosis
```

### GATE B — Intent Diagnosis (§86.3)

```text
CATALOG_GAP ≥ 50%   → dừng v1.3, chuyển sang COVERAGE
CATALOG_GAP 25–50%  → chạy scope giảm (bỏ M20.8)
CATALOG_GAP < 25%   → full scope
```

```text
M20.1  Lexical Relevance Upgrade      ← rẻ nhất, làm trước
M20.2  Semantic Search Foundation
M20.3  Hybrid Search
M20.4  Smart Ranking & Relevance
```

### STOP 1 — Search Quality (§91)

```text
4-way benchmark. Chỉ tiếp nếu HYBRID ≥ +15% NDCG so với LEXICAL UPGRADED.
```

```text
M20.5  Natural Language Course Finder
M20.6  Similar Courses
M20.7  Course Comparison
M20.8  Learning Goal / Path Builder    (có thể đã bị hoãn ở GATE B)
M20.9  Cross-Language VI ↔ EN
```

### STOP 2 — Product Discovery Validation (§97)

```text
Human review + benchmark + latency/cost. Quyết định theo TỪNG flag.
```

```text
M20.10  Discovery Analytics & Evaluation
M20.11  Production Hardening
```

### RELEASE

```text
v1.3 RC
→ staged feature flags theo §99.4
→ production smoke
→ quan sát 4 tuần theo §109
→ v1.3
```

---

# 107. Rủi ro & điểm dừng

```text
v1.3 giải sai bài toán
  → §80.2 Precondition Check trước Gate A
  → §86.3 Intent Diagnosis, CATALOG_GAP ≥ 50% thì dừng

Semantic che mất tín hiệu catalog gap
  → unmet_intent + lexical_would_be_zero (§89.6)
  → admin queue chuyển sang đọc unmet_intent

Chi phí query embedding trượt
  → cache hit ≥ 60%, budget cứng, degrade thay vì lỗi
  → báo cáo USD thật hàng tuần, không chỉ token

Embedding model bị provider deprecate
  → EmbeddingProvider abstraction + embedding_version
  → re-embed job phải chạy được bounded bất cứ lúc nào
  → giữ ước tính chi phí re-embed toàn catalog trong runbook

Chọn model không multilingual rồi phải re-embed
  → multilingual là tiêu chí BẮT BUỘC ở M20.2 (§88.3), không phải M20.9

Label rot làm benchmark vô nghĩa
  → catalog_snapshot_id, label chỉ chấm topical relevance
  → label decay > 20% → re-label trước khi dùng làm gate (§86.5)

Nút thắt operator (label + review)
  → 2 người × 4 giờ cho Intent Diagnosis, ước tính riêng cho labeling
  → v1.2 §79.5 đã cảnh báo; không coi human review là miễn phí

NL Finder bị abuse (không có account)
  → per-IP + global cap + intent cache + degrade (§92.4)

Over-engineering hạ tầng vector
  → không ANN index, không vector DB riêng
  → ngưỡng mở lại: > 20 000 course hoặc vector p95 > 250ms

Retrieval tốt lên nhưng North Star không đổi
  → §109 outcome gate, 4 tuần
  → nếu CTR phẳng, ghi pivot log, KHÔNG build tiếp lên

Scope creep
  → không account, không progress tracking, không review system,
    không redesign, không thêm category
```

---

# 108. Cursor Execution Rules v1.3

Bổ sung `§63` và `§77`:

```text
38. Đọc project-plan gốc + v1.2 + v1.3 trước mỗi milestone.
39. Không assume report cũ là truth. Inspect code thật.
40. Không implement M20 trước khi Gate A PASS.
41. Không implement M20.2+ trước khi Gate B (§86.3) có kết luận.
42. Làm M20.1 (lexical) trước M20.2 (semantic). Không đảo.
43. Không thay Truth Engine bằng AI. TruthFilter là chỗ duy nhất.
44. Không dùng semantic score hay ai_score làm quality/ranking chính.
45. Không AI-generate course, certificate, giá không có trong catalog.
46. Không AI publish/approve.
47. Không vectorize raw HTML, audit log, evidence dump, số nội bộ.
48. Field không có trong schema thì KHÔNG đưa vào semantic document.
    Không tự thêm cột để cho khớp tài liệu.
49. AI-derived field chỉ embed khi đã qua Zod schema §18 và có flag riêng.
50. Không tạo vector DB riêng. Không xây ANN index ở quy mô hiện tại.
51. EmbeddingProvider là abstraction riêng, không nhét vào AIProvider.
52. Embedding phải versioned. Không trộn mixed-version im lặng.
53. Re-embedding phải idempotent, bounded, resume được.
54. Embedding job chạy trong apps/monitor queue (M19.4/M19.5).
    Không viết worker mới. Không backfill trên serverless.
55. Mỗi search KHÔNG được là một embedding call mới. Phải qua cache.
56. Semantic/vector/AI failure phải fallback lexical. Không trả 500.
57. Exact-title search phải có regression test, ngưỡng ≥ 98%.
58. Ranking + threshold config centralized, versioned, có benchmark diff.
59. AI query parser: deterministic trước, AI chỉ khi không đủ.
60. Invalid AI output → fallback raw query. Max 1 retry (§18).
61. User text là DATA. Có fixture prompt-injection.
62. Kết quả dưới relevance floor → empty state trung thực + CTA watch.
    Không lấp trang bằng match yếu.
63. Mọi retrieval change phải giữ unmet_intent + lexical_would_be_zero.
64. Mở rộng search_queries (§67.4). Không tạo bảng analytics trùng.
65. Cross-language phải benchmark VI riêng, tách có dấu / không dấu.
66. Public feature mới phải có EN + VI trong cùng milestone.
67. Milestone tạo entity mới phải ship admin UI cùng milestone (rule 36).
68. Mọi embedding/AI call ghi api_usage_log kèm worker_version (rule 31).
69. Không index search query URL. Compare URL noindex.
70. Không tạo persistent sensitive user profile.
71. Mỗi external/AI call có budget + timeout + observability.
72. Vượt budget → degrade, không lỗi, không trả rỗng.
73. Feature lớn có kill switch, mặc định OFF khi deploy (rule 32).
74. CTR không được thành ranking signal trong v1.3.
75. Không commit/push/deploy nếu prompt milestone không yêu cầu.
76. Không gộp nhiều milestone M20 thành một implementation run.
77. Dừng đúng STOP gate. Gate không có số thì không phải gate.
```

---

# 109. Definition of Done v1.3

v1.3 không DONE chỉ vì M20.11 build xanh.

## 109.1 Engineering DONE

```text
Gate 0 + Gate A + Gate B PASS
STOP 1 + STOP 2 có quyết định ghi lại
hybrid NDCG@10 ≥ +15% so với LEXICAL UPGRADED (không phải so baseline cũ)
exact-title success ≥ 98%, regression ≤ 1pp
VI (có dấu + không dấu) đạt ≥ 0.80 × điểm EN
search p95 ≤ 600ms
semantic outage → fallback lexical PASS
toàn bộ AI/vector OFF → site usable PASS
AI intent parser không invent course
truth/free/certificate invariant không regression
similar courses chỉ trả course eligible
compare không có claim subjective
learning path chỉ dùng course thật
relevance floor hoạt động, empty state trung thực
unmet_intent được log và có mặt trên admin queue
latency + cost trong budget, có số USD thật
security review PASS (kèm prompt injection)
staged rollout PASS, rollback được < 15 phút
admin UI đủ cho mọi entity mới
```

## 109.2 Outcome DONE — phần bản nháp trước thiếu

North Star là `Outbound Course Clicks`. Engineering xanh mà North Star phẳng
thì v1.3 chưa giải được gì.

Quan sát **4 tuần** sau khi hybrid lên 100%:

```text
outbound CTR từ search        trước ___%  →  sau ___%
search → detail CTR           trước ___%  →  sau ___%
% session có dùng search      trước ___%  →  sau ___%
unmet_intent rate             trước ___%  →  sau ___%
returning visitor %           trước ___%  →  sau ___%
```

Đọc kết quả:

```text
NDCG tăng + outbound CTR tăng
  → v1.3 đúng. Đóng version.

NDCG tăng + outbound CTR PHẲNG
  → retrieval KHÔNG phải bài toán
  → ghi pivot log, KHÔNG build tiếp discovery feature ở v1.4
  → nghi vấn tiếp theo: catalog (COVERAGE) hoặc distribution (SEO)

NDCG tăng + unmet_intent CAO
  → xác nhận bài toán là CATALOG
  → v1.4 = coverage expansion, dùng unmet_intent làm discovery query

outbound CTR giảm
  → rollback flag, điều tra relevance floor và ranking config
```

Không đóng v1.3 mà không điền bảng này.

---

# 110. Changelog

```text
v1.0    WP0 → WP14              MVP
v1.1    M15 → M17               Hardening, Intelligence, SEO Growth
v1.1.x  WP18                    Polish, I18N, Source Fetching
v1.2    M19.0 → M19.10          Control, Truth, Coverage & Time
v1.3    M20.0 → M20.11          Smart Discovery, Relevance & Decision
```

---

# 111. Quyết định triển khai ngay sau tài liệu này

```text
1.  Điền §80.2 Precondition Check bằng số production thật.
2.  Chạy v1.2 Production Audit (§81) bằng model reasoning mạnh,
    gồm 6 câu hỏi bổ sung cho v1.3.
3.  Xuất findings P0/P1/P2/P3 + evidence matrix.
4.  Fix P0/P1 + regression tests.
5.  Smoke production. Chốt Gate A.
6.  M20.0: baseline + Intent Diagnosis + evaluation dataset + chốt bảng §85.
7.  GATE B: đọc CATALOG_GAP, quyết định full scope / scope giảm / dừng.
8.  M20.1 lexical upgrade. Báo cáo đã đóng bao nhiêu % khoảng cách.
9.  M20.2 → M20.4. STOP 1, benchmark 4 chiều.
10. Chỉ khi PASS mới làm M20.5 → M20.9. STOP 2 theo từng flag.
11. M20.10 → M20.11 → staged release.
12. Quan sát 4 tuần theo §109.2 rồi mới gọi v1.3 DONE.
```

**Không chạy một mạch M20.0 → M20.11 qua đêm.**

Lý do: semantic retrieval và ranking là nền của NL Finder, Similar Courses và
Learning Path. Nếu retrieval sai, các feature phía trên chỉ làm lỗi nền trông
đẹp hơn. Và nếu bài toán thật là catalog chứ không phải retrieval, thì cả 11
milestone chỉ làm cái kệ trống được sắp xếp gọn hơn.

---

# 112. Phụ lục — Khác biệt so với bản nháp v1.3

Để review nhanh, đây là những gì đã thay đổi:

**Thêm mới**

```text
§80.2   Precondition Check — bắt buộc điền số của v1.1 §60 và v1.2 §75
§80.3   Ràng buộc quy mô catalog
§85     Bảng ngưỡng số bắt buộc (bản nháp gần như không có số nào)
§86.3   Intent Diagnosis: RETRIEVAL_MISS / CATALOG_GAP / CONSTRAINT_GAP
        + GATE B có thể dừng cả v1.3
§86.5   Chống label rot bằng catalog_snapshot_id
§87     M20.1 Lexical Relevance Upgrade (unaccent, pg_trgm, VI không dấu)
§88.3   Chọn embedding model — multilingual là tiêu chí BẮT BUỘC tại đây
§89.3   Query embedding cache — trục chi phí thật
§89.5   Relevance floor + empty state trung thực + CTA watch
§89.6   unmet_intent / lexical_would_be_zero — bảo toàn tín hiệu §67.4
§92.4   Abuse & cost design cho NL Finder (không có account)
§104    Env Variables (bản nháp thiếu hoàn toàn)
§107    Rủi ro & điểm dừng (bản nháp thiếu, v1.2 §76 có)
§109.2  Outcome DONE — quan sát North Star 4 tuần
```

**Sửa lỗi**

```text
§88.2   Bản nháp tự mâu thuẫn: liệt kê skills / learning outcomes (không có
        trong schema) và summary (là AI output) trong khi cấm AI chain output.
        Đã chốt policy rõ ràng cho từng loại field.
§88.3   Bản nháp chọn model ở M20.1 nhưng yêu cầu multilingual chỉ xuất hiện
        ở M20.8 → sẽ phải re-embed toàn catalog. Đã dồn lên trước.
§84     Bản nháp không nói worker nào chạy embedding. Đã chốt: tái dùng
        apps/monitor queue của M19.4/M19.5.
§88.5   Đã cấm ANN index ở quy mô hiện tại, kèm ngưỡng mở lại.
§100.2  Bản nháp đề xuất bảng search_runs mới, trùng search_queries của
        v1.2 §67.4. Đã chuyển thành ALTER.
§91     STOP 1 giờ so 4 chiều (thêm LEXICAL UPGRADED), tránh so với baseline
        yếu rồi tự khen.
§99.3   Chi phí: bản nháp bound document embedding; trục thật là query
        embedding mỗi lần search. Đã sửa.
§108    Thêm rule cho admin UI (v1.2 rule 36) và api_usage_log (rule 31)
        mà bản nháp bỏ sót.
```

**Đánh số milestone thay đổi**

```text
bản nháp          →   bản này
M20.1 Semantic    →   M20.2   (M20.1 giờ là Lexical Upgrade)
M20.2 Hybrid      →   M20.3
M20.3 Ranking     →   M20.4
M20.4 NL Finder   →   M20.5
M20.5 Similar     →   M20.6
M20.6 Compare     →   M20.7
M20.7 Path        →   M20.8
M20.8 Cross-lang  →   M20.9
M20.9 Analytics   →   M20.10
M20.10 Hardening  →   M20.11
```
