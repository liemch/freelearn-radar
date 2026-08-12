# M17 Product Experience Audit

Date: 2026-08-13  
Scope: Public UX, discovery, SEO growth (post M15/M16)

## 5-second understanding

| Signal | Status |
|--------|--------|
| Brand + value prop in hero | Present |
| Search CTA “What do you want to learn?” | Present |
| Free status emphasized on cards | Present after M15 |
| Clear “we link out to providers” | Weak on homepage |

**Fix:** Hero supporting line + outbound honesty; stronger collection nav.

## 30-second findability

| Path | Friction |
|------|----------|
| Topic browse | Category rails exist; no SEO topic landings (`/free-courses/*`) |
| Provider browse | Only `?provider=` filter — no `/provider/[slug]` |
| Free certificate | Backend filter exists; no UI / dedicated page |
| Short courses | Only `sort=shortest`; no duration collections |
| Monthly best | Hardcoded nav month; weak selection vs trust |

## Free-status clarity

| Item | Status |
|------|--------|
| Price badges on cards | Good |
| Certificate on cards | Present but quieter |
| Verification freshness | On detail only |
| “What is free” on detail | Incomplete |

## Information density (course detail)

Must see without heavy reading: provider, level, duration, certificate, verification — partially met; CTA needs clearer “leaves FreeLearn Radar” framing.

## SEO gaps

- No provider / topic / certificate / duration landing routes
- No JSON-LD
- Weak metadata on home/search/category
- Sitemap missing providers, landings, historical best months
- Filter URL params not all in UI (`certificate`, duration)
- Hardcoded `/best/2026/08` in header/footer
- Search with params can create crawl space (needs indexing policy)

## Implementation priorities (M17)

1. Homepage IA sections (conditional)
2. Filters: certificate + duration + pagination param parity
3. `/provider/[slug]`, `/free-courses/[topic]`, `/free-certificate-courses`, duration collections
4. Related courses + internal links
5. Course CTA / share / JSON-LD / metadata / sitemap / robots policy
6. Lightweight product events (privacy-conscious)
7. Tests + docs

## Out of scope

User accounts, newsletter, paid features, live API credentials, M18.
