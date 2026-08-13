import { getPreferredLocale } from "@/lib/i18n/server-locale";
import type { Locale } from "@/lib/i18n/config";

/** Admin routes are not locale-prefixed, so locale comes from the cookie. */
export async function getAdminLocale(): Promise<Locale> {
  return getPreferredLocale();
}
