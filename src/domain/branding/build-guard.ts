/**
 * Branding reads hit Postgres. During `next build` static generation, many
 * pages share a single pooled connection and the site_settings table may not
 * exist yet — so we skip DB and use bundled defaults at build time. Runtime
 * requests (including force-dynamic pages) still resolve live Admin assets.
 */
export function shouldSkipBrandingDb(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}
