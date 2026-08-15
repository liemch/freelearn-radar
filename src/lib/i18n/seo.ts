import type { Metadata } from "next";

import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/path";

/**
 * Canonical + hreflang for a locale-less public path (e.g. `/search`).
 *
 * M20.14 made the product Vietnamese-only, so only the Vietnamese URL is
 * advertised: it is the canonical for every locale and the sole hreflang plus
 * `x-default`. The `/en/*` routes keep serving (§117 rules 7–8 forbid 404ing
 * indexed routes), they are simply no longer offered to crawlers as an
 * alternate — which is what previously kept English duplicates in the index.
 */
export function buildLocaleAlternates(
  appUrl: string,
  _locale: Locale,
  path: string,
): NonNullable<Metadata["alternates"]> {
  const canonicalPath = localePath(defaultLocale, path);
  const canonicalUrl = `${appUrl}${canonicalPath}`;

  return {
    canonical: canonicalPath,
    languages: {
      [defaultLocale]: canonicalUrl,
      "x-default": canonicalUrl,
    },
  };
}
