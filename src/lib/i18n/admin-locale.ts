import { defaultLocale, type Locale } from "@/lib/i18n/config";

/** Admin routes are not locale-prefixed. M20.14: Vietnamese-only admin UI. */
export async function getAdminLocale(): Promise<Locale> {
  return defaultLocale;
}
