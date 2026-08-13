import { cookies } from "next/headers";

import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

/**
 * Locale for server routes that are not locale-prefixed (admin, root 404).
 * The middleware writes this cookie on every locale-prefixed public request,
 * and the language switcher writes it on an explicit user choice.
 */
export async function getPreferredLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value && isLocale(value) ? value : defaultLocale;
}
