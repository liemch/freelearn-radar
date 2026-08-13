# Course Evidence Model

## Purpose

Answer: **Why do we believe this course is free / has a free certificate?**

Every important claim should be traceable to an observed value with method and confidence.

## Record shape

`EvidenceRecord` (`src/domain/verification/evidence.ts`):

| Field | Meaning |
| --- | --- |
| `type` | `PRICE`, `CERTIFICATE`, `TITLE`, `URL`, `METADATA`, … |
| `observedValue` | What was seen |
| `sourceUrl` | Where it was seen |
| `sourceProvider` | Provider hint when known |
| `method` | Provenance |
| `confidence` | 0–1 |
| `observedAt` | ISO timestamp |

## Methods

Domain methods:

- `SEARCH` — Tavily / search snippets
- `PAGE_METADATA` — HTML fetch (JSON-LD / OG / meta / page text)
- `PROVIDER_DATA` — reserved for provider APIs
- `AI_EXTRACTION` — NVIDIA suggestion (never overrides strong deterministic evidence)
- `MANUAL` — human approval

DB verification enum maps: `AI_EXTRACTION` → `AI`, `PROVIDER_DATA` → `PAGE_METADATA`.

## Free status conservatism

`classifyFreeStatusFromText` refuses to promote marketing language:

| Phrase | Result |
| --- | --- |
| Enroll for free / audit for free | `FREE_AUDIT` |
| Try free for N days | `FREE_TRIAL` |
| Free preview | `UNKNOWN` |
| Start/learn for free (ambiguous) | `UNKNOWN` |
| Free with subscription | `PAID` |
| Completely free / 100% free (no contradiction) | `FREE_FULL` |

AI may fill a true evidence gap only; it cannot upgrade a deliberate refusal.

## Certificate conservatism

| Phrase | Result |
| --- | --- |
| Free certificate | `FREE_CERTIFICATE` |
| Certificate available / earn a certificate | `UNKNOWN` |
| Buy/purchase certificate | `PAID_CERTIFICATE` |

## Persistence

- **Candidates:** `source_evidence_json` stores the full `CourseSourceResult` snapshot (evidence array, warnings, images, policy, redirect chain).
- **Courses:** approval creates `course_verifications.evidence_json` with MANUAL method summarizing the resolved classification.

## Admin UX

Candidate detail shows:

- Original canonical URL
- Final source URL + fetch timestamp
- Image source URL when extracted
- Raw content excerpt
- Expandable technical JSON including `sourceFetch` + AI analysis
