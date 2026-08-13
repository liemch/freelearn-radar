"use client";

import { usePathname } from "next/navigation";

import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { localizeHref, stripLocalePrefix } from "@/lib/i18n/path";

/** Current locale from the URL (authoritative for client navigation). */
export function useCurrentLocale(): Locale {
  const pathname = usePathname() ?? "/";
  return stripLocalePrefix(pathname).locale || defaultLocale;
}

/** Locale-aware path helper bound to the live URL locale. */
export function useLocalizedPath(path: string): string {
  const locale = useCurrentLocale();
  return localizeHref(path, locale);
}
