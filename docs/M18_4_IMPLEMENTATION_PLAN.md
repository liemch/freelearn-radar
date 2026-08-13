# M18.4 Implementation Plan — Course Source Fetching

## Audit summary

| Capability | Status |
| --- | --- |
| Search → Candidate ingest | Exists (`discovery-engine`, Tavily) |
| HTML / course page fetch | **Missing** |
| SSRF-safe image fetch | Exists (`course-image-service`) — reuse patterns |
| URL normalize / http(s) assert | Exists (`lib/url.ts`) — extend for private IP |
| Free / certificate classifiers | Exists (`free-status`, `certificate-status`) |
| Evidence model | Exists (`EvidenceRecord`) — method `PAGE_METADATA` unused for HTML |
| `FETCHED` discovery status | Enum exists, never set |
| JSON-LD / OpenGraph parsers | **Missing** (public JSON-LD is output-only) |
| Provider fetch policy | **Missing** |
| AI after page fetch | Today AI runs on Tavily snippets only |

## Target pipeline

```
SearchProvider
  → URL validate / normalize / prefilter / dedupe
  → CourseSourceFetcher (budgeted, SSRF-safe)
  → Metadata + evidence extraction (JSON-LD → OG → HTML meta → bounded text)
  → Candidate enrichment (status FETCHED)
  → Deterministic free/certificate classification
  → NVIDIA analysis (only if still useful; content already sanitized)
  → Admin review
```

## Modules to add

| Module | Responsibility |
| --- | --- |
| `src/lib/safe-fetch-url.ts` | Block private/link-local/metadata IPs, localhost, non-http(s); validate redirect targets |
| `src/services/fetch/provider-fetch-policy.ts` | Per-provider `FETCH_ALLOWED` / `METADATA_ONLY` / `SEARCH_RESULT_ONLY` / `NO_FETCH` + image policy |
| `src/services/fetch/safe-http-client.ts` | Timeout, max redirects (manual), max bytes, content-type check |
| `src/services/fetch/metadata-extractor.ts` | JSON-LD, OpenGraph, title/description/canonical, bounded visible text |
| `src/services/fetch/course-source-fetcher.ts` | `fetchCourseSource(url)` → `CourseSourceResult` |
| `src/domain/candidate/fetch-candidate-source.ts` | Wire fetch into candidate lifecycle; set `FETCHED` / failure states |
| Tests under `src/test/m18-4-*.test.ts` and unit tests beside modules |

## Schema

Avoid a heavy migration if possible. Persist:

- Enriched `rawTitle` / `rawDescription` / `rawContent` from extraction
- Structured fetch + evidence snapshot inside a new nullable jsonb column `source_evidence_json` on `course_candidates` (clean admin UX + preserves across AI overwrite of `ai_analysis_json`)
- Optional `source_fetched_at`, `source_final_url`, `source_image_url` columns for queryability

If migration is blocked in CI without DB, keep drizzle schema + SQL migration file; runtime code must tolerate nulls.

## Security decisions

1. Only `http:` / `https:`; reject file/data/javascript/ftp.
2. Block localhost, loopback, private RFC1918, link-local, `169.254.169.254`, IPv6 ULA/loopback.
3. Manual redirect following with re-validation of every hop (do not use blind `redirect: "follow"` for HTML).
4. Cap: timeout, redirects, response bytes, fetches per run (env-configurable).
5. External HTML is DATA only; strip tags before AI; reuse `sanitizeExternalContent`.
6. Image extraction reuses `validateImageUrl` / `ingestCourseImage`; failure never blocks candidate.

## Provider policy defaults

Config map by provider slug/domain (code, not DB):

- Most known providers: `FETCH_ALLOWED` + `REMOTE_ONLY` images
- Unknown domains: `METADATA_ONLY` (fetch once, no deep text scrape)
- Explicit deny list: `NO_FETCH`

## Integration points

1. After `ingestSearchResult` creates `DISCOVERED`, cron/admin runs `fetchPendingCandidates` before `analyzePendingCandidates`.
2. `analyzeCandidate` prefers fetched content; reuses analysis when content hash unchanged.
3. Admin candidate detail shows source URL, final URL, evidence summary, image URL, warnings.
4. Verify cron may later use PAGE_METADATA — out of scope unless trivial; discovery path is primary.

## Out of scope

- Full-site crawling / robots.txt crawling of entire sites
- Playwright / browser automation
- Live Vercel Blob credentials
- M18.5 / M19
- Committing / pushing / deploying

## Test plan (minimum)

Safe URL matrix, redirect SSRF, oversized/timeout/non-HTML, JSON-LD/OG extraction, deceptive free phrases, image failure non-blocking, pipeline order (fetch before AI; skip AI on duplicate/invalid).

## Success criteria

Matches milestone §51; final status `M18_4_SOURCE_FETCH_COMPLETE` or `M18_4_BLOCKED`.
