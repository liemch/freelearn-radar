# M20.12 — Monetization Foundation

Status: **SHIPPED behind flags (OFF by default)** — 2026-08-14

## Shipped

- Tables: `affiliate_providers`, `affiliate_campaigns`, `affiliate_placements`,
  `affiliate_clicks` (`drizzle/0011_m20_12_monetization.sql`)
- `AffiliateLinkService` — allowlist hosts, reject unsafe schemes, tracked hop
  `/go/affiliate` (tracking failure never blocks redirect)
- Flags: `FEATURE_MONETIZATION`, `FEATURE_COURSE_AFFILIATE`,
  `FEATURE_COMMERCE_AFFILIATE` (all default false)
- Seed providers/campaigns **disabled** until explicitly enabled in DB + flags
- Admin → Monetization (providers + 30d click stats)
- Disclosure helper (`Liên kết tiếp thị` / `Affiliate link`)
- Privacy: `affiliate_clicks` stores no IP — only provider/placement/host/locale

## Invariants kept

- Zero affiliate/revenue signal in search ranking
- Zero change to Truth / free eligibility
- Course outbound `/course/[slug]/go` unchanged as North Star path

## Docs

Retention for affiliate clicks should follow the same bounded analytics policy
as `outbound_clicks` (operational logs, not PII warehouse).
