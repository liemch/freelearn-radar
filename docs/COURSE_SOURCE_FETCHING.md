# Course Source Fetching

## Lifecycle

```
DISCOVERED candidate
  → resolveProviderFetchPolicy(slug/url)
  → validateSafeFetchUrl (every hop)
  → safeHttpGet (manual redirects, timeout, max bytes)
  → extractPageMetadata (JSON-LD → OpenGraph → HTML meta → bounded text)
  → classify free/certificate from extracted text
  → persist source_* fields + status FETCHED (or soft/hard failure)
  → analyzeCandidate (NVIDIA) on enriched content
```

Cron wiring: `/api/cron/discover` runs discovery → `fetchPendingCandidates` → `analyzePendingCandidates`.

## Security model

- Only `http` / `https`
- Reject `file`, `data`, `javascript`, `ftp`, credentials-in-URL, protocol-relative URLs
- Block localhost, loopback IPv4/IPv6, RFC1918, link-local, CGNAT, metadata `169.254.169.254`
- Redirects are followed manually; **each** Location target is re-validated
- Response size, redirect count, and timeout are bounded via env:
  - `MAX_SOURCE_FETCHES_PER_RUN` (default 20)
  - `SOURCE_FETCH_TIMEOUT_MS` (default 10000)
  - `SOURCE_MAX_RESPONSE_BYTES` (default 512KiB)
  - `SOURCE_MAX_REDIRECTS` (default 5)

## Provider policy

Configured in `src/services/fetch/provider-fetch-policy.ts`:

| Policy | Behavior |
| --- | --- |
| `FETCH_ALLOWED` | Full HTML + deep text excerpt |
| `METADATA_ONLY` | Fetch page but only title/description/OG (no deep text scrape) |
| `SEARCH_RESULT_ONLY` | Skip fetch; keep Tavily snippets |
| `NO_FETCH` | Skip fetch |

Unknown public domains default to `METADATA_ONLY`.

## Modules

| Path | Role |
| --- | --- |
| `src/lib/safe-fetch-url.ts` | SSRF URL validation |
| `src/services/fetch/safe-http-client.ts` | Safe GET |
| `src/services/fetch/metadata-extractor.ts` | Deterministic parsers |
| `src/services/fetch/course-source-fetcher.ts` | `fetchCourseSource` |
| `src/services/fetch/provider-fetch-policy.ts` | Policy map |
| `src/domain/candidate/fetch-candidate-source.ts` | Candidate integration |

## Failure behavior

| Condition | Candidate outcome |
| --- | --- |
| 404 / 410 / unsafe redirect | `INVALID` |
| timeout / 403 / 429 / 5xx / network | stay `DISCOVERED`, error note, AI may still use search snippets |
| policy skip | stay `DISCOVERED`, evidence records skip |
| success | `FETCHED` with enriched raw fields |

Fetch exceptions never crash the batch.

## AI boundary

External HTML is stripped to text before persistence. NVIDIA receives bounded `rawTitle` / `rawDescription` / `rawContent` via existing `sanitizeExternalContent` in the AI provider — never raw HTML, never system-instruction injection from page content.
