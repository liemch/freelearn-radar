# M18.4 — Course Source Fetching & Evidence Extraction

Status: **M18_4_SOURCE_FETCH_COMPLETE**

## Existing functionality reused

| Module | Reuse |
| --- | --- |
| `lib/url.ts` | Canonical normalization after fetch |
| `services/images/course-image-service.ts` | SSRF patterns + image URL validation inspiration; image fields on approve |
| `domain/verification/free-status.ts` | Deterministic free classification from page text |
| `domain/verification/certificate-status.ts` | Deterministic certificate classification |
| `domain/verification/evidence.ts` | Evidence records with `PAGE_METADATA` |
| `services/ai/*` | Downstream AI; receives enriched snippets, not raw HTML |
| `discovery_status.FETCHED` | Already in enum; now actually set |

## New modules

| Path | Purpose |
| --- | --- |
| `src/lib/safe-fetch-url.ts` | SSRF host/IP/scheme validation |
| `src/services/fetch/safe-http-client.ts` | Manual-redirect safe GET |
| `src/services/fetch/metadata-extractor.ts` | JSON-LD / OG / HTML meta / bounded text |
| `src/services/fetch/provider-fetch-policy.ts` | Per-provider fetch + image policy |
| `src/services/fetch/course-source-fetcher.ts` | `fetchCourseSource(url)` |
| `src/domain/candidate/fetch-candidate-source.ts` | Candidate lifecycle + batch |

## Pipeline changes

```
Search → ingest (DISCOVERED)
  → fetchPendingCandidates (FETCHED / soft-fail / INVALID)
  → analyzePendingCandidates (FETCHED first, then remaining DISCOVERED)
  → Admin review → approve (copies sourceImageUrl onto course)
```

Cron `/api/cron/discover` now runs source fetch before AI.

## Schema changes

Migration `drizzle/0004_candidate_source_fetch.sql`:

- `source_evidence_json` jsonb
- `source_fetched_at` timestamptz
- `source_final_url` text
- `source_image_url` text

Also reflected in `scripts/neon-bootstrap.sql` and Drizzle schema.

## Security decisions

- Private IP / loopback / metadata blocked on **initial URL and every redirect hop**
- No automatic `redirect: "follow"` for HTML
- Bounded timeout / bytes / redirects / fetches-per-run
- External HTML never rendered; stripped to text before persistence
- Image extraction failures do not block candidates; approve uses remote URL only (`REMOTE_ONLY`)

## Metadata strategy

Priority: JSON-LD Course-like nodes → OpenGraph → `<title>` / meta description → bounded visible text (when `FETCH_ALLOWED`).

## Evidence strategy

Source fetch appends `PAGE_METADATA` evidence for title, description, URL, price, and certificate signals. Snapshot stored on the candidate for admin review.

## Image strategy

Extract `og:image` + JSON-LD image URLs when safe. Persist first as `source_image_url`. On approval, set course `imageSourceUrl` with `REMOTE_ONLY` policy. Full `ingestCourseImage` storage remains available but is not required for pipeline success.

## Provider policies

Code map for Coursera / Udemy / edX / Microsoft Learn / freeCodeCamp (`FETCH_ALLOWED`), LinkedIn Learning (`METADATA_ONLY`), unknown domains (`METADATA_ONLY`), `.internal`/`.local` (`NO_FETCH`).

## AI cost impact

AI runs after fetch enrichment and still skips via content-hash reuse. Invalid/prefilter rejects still avoid NVIDIA. Soft fetch failures allow AI on search snippets so discovery is not blocked by flaky providers.

## Tests

| | Count |
| --- | --- |
| Before M18.4 source work | 213 |
| After | **239** (+26 in `m18-4-source-fetch.test.ts`) |

Coverage includes SSRF URL matrix, redirects, oversized/non-HTML, HTTP errors, JSON-LD/OG, deceptive free phrases, certificate conservatism.

## Quality gates

| Gate | Result |
| --- | --- |
| lint | PASS (1 pre-existing font warning) |
| typecheck | PASS |
| test | PASS — 239 |
| build | PASS |

## M18.3 follow-up in this pass

Extended `buildLocaleAlternates` hreflang to category, provider, topic, collections, certificates, and best-of-month pages (previously homepage/search/course only).

## Known limitations

- No live DNS rebinding protection beyond hostname string checks (no custom resolver)
- No robots.txt crawler — policy is code-configured per provider
- Verify cron still uses Tavily snippets (PAGE_METADATA HTML path is discovery-primary)
- Image binary storage not auto-invoked on fetch (remote URL only on approve)
- Provider-specific CSS extractors not added (generic parsers only)

## Pending live verification

- Run migration `0004` against Neon
- Cron discover against a live Coursera/Udemy URL with `TAVILY_API_KEY`
- Confirm admin candidate detail shows final URL + evidence JSON

## Docs

- `docs/M18_4_IMPLEMENTATION_PLAN.md`
- `docs/COURSE_SOURCE_FETCHING.md`
- `docs/COURSE_EVIDENCE_MODEL.md`
- `docs/M18_4_SOURCE_FETCH_REPORT.md` (this file)

Note: `docs/M18_4_TRANSLATION_COMPLETENESS.md` documents the earlier EN/VI copy pass (shipped as `b5c89ea`) and is orthogonal to this source-fetch milestone.
