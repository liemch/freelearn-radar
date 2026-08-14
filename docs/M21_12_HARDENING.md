# M21.12 — Feature flags & production hardening notes

## Feature flags (default OFF)

| Flag | Purpose |
|------|---------|
| `FEATURE_COUPON_DISCOVERY` | Enable coupon source fetch + cron |
| `FEATURE_COUPON_PUBLIC_SURFACE` | Emphasize coupon UX on daily-free (page still renders with catalog fallback) |
| `FEATURE_MEDIA_RESOLVER` | Remote image validation path |
| `FEATURE_INTERESTS` | Interest picker / For you |
| `FEATURE_DISCOVERY_UX` | Homepage IA + discovery nav (VI also gets discovery nav) |

Taxonomy / schema migrations are NOT gated.

## Cost guards

- `COUPON_DISCOVERY_MAX_PAGES_PER_RUN` (default 5)
- `COUPON_DISCOVERY_MAX_CANDIDATES_PER_RUN` (default 40)
- `COUPON_VERIFY_CONCURRENCY` (default 2)
- `COUPON_VERIFY_LIMIT` (default 25)
- `IMAGE_RESOLVE_CONCURRENCY` (default 4)
- Kill switch: set `FEATURE_COUPON_DISCOVERY=false`

## Security invariants covered by tests

- couponCode preserved through normalize/parse
- aggregator cannot self-publish ACTIVE_100_OFF
- expired/invalid not Coupon 100%
- FREE_PREVIEW excluded from free lists
- image SSRF blocked (private hosts)
- unsafe outbound URL schemes rejected
- Vietnamese-only UI (`defaultLocale=vi`, switcher OFF)
