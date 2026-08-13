import type { Metadata } from "next";

import { locales, type Locale } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/path";

/** Canonical + hreflang for a locale-less public path (e.g. `/search`). */
export function buildLocaleAlternates(
  appUrl: string,
  locale: Locale,
  path: string,
): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const code of locales) {
    languages[code] = `${appUrl}${localePath(code, path)}`;
  }
  languages["x-default"] = `${appUrl}${localePath("en", path)}`;

  return {
    canonical: localePath(locale, path),
    languages,
  };
}
