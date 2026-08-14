# M20.13 — Contextual Affiliate Recommendations

Status: **SHIPPED behind flags (OFF by default)** — 2026-08-14

## Placements

| Key | Surface |
|-----|---------|
| `COURSE_DETAIL_RELATED_LEARNING` | Course detail (after related courses) |
| `LEARNING_PATH_RESOURCES` | `/[locale]/path` |
| `TOPIC_LEARNING_RESOURCES` | Topic tag page |

## Rules

- Cards are dashed-border resource links, never course cards
- Commerce offers filtered by `commerce-relevance.ts` topic→product group map
- Commission is never a sort key — priority is editorial placement order only
- Kill switch `FEATURE_MONETIZATION=false` hides all placements

## Gate note

Requires M20.12 schema + seed. Enable only after reviewing allowlisted
destinations and disclosure copy for each network.
