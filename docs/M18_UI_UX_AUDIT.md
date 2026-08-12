# M18 UI/UX Audit

Date: 2026-08-13  
Approach: **Refine M17**, do not rewrite.  
Status: **P0–P2 implemented** in M18 working tree (not committed).

## Summary

M17 discovery/SEO structure is sound. Issues were consistency, enum leaks, badge/info density, and radius drift — not architecture.

## Findings

### P0

| ID | Issue | Action | Status |
|----|-------|--------|--------|
| P0-1 | Course detail free badge always emerald | Shared `FreeStatusBadge` with tone by type | Done |
| P0-2 | Public copy exposes `FREE_CERTIFICATE` / `UNKNOWN` | Human labels only | Done |
| P0-3 | Admin courses table shows raw enums | Use label helpers | Done |

### P1

| ID | Issue | Action | Status |
|----|-------|--------|--------|
| P1-1 | Homepage too many overlapping sections | Consolidate topic rails; tighten copy | Done |
| P1-2 | Course detail repeats free/cert in 8 bordered boxes | Slim key facts; borderless dl | Done |
| P1-3 | Radius drift (`2xl`/`xl`/`lg`/`md`) | Surfaces → `rounded-xl`; controls → `rounded-md` | Done |
| P1-4 | Catalog filters bypass Button/Input + duplicate labels | Align primitives + import labels | Done |
| P1-5 | Certificate label copy inconsistent | Normalize in `labels.ts` | Done |
| P1-6 | Admin candidate raw status enums | Human labels | Done |
| P1-7 | AI score visually competes on cards | Demote/remove from card scan path | Done |

### P2

| ID | Issue | Action | Status |
|----|-------|--------|--------|
| P2-1 | Empty/pagination not using Button | Align | Done |
| P2-2 | Emoji badges a11y | Color + text + mark | Done |
| P2-3 | Header font-display inconsistency | `font-display` + BrandMark | Done |
| P2-4 | Canonical URL noisy on public course | `sr-only` | Done |
| P2-5 | Brand/favicon lightweight polish | BrandMark + `app/icon.tsx` | Done |

## Visual direction (preserve)

Teal learning palette, Fraunces+Manrope, calm surfaces, free-status-first. No purple glow / glass crypto look.
