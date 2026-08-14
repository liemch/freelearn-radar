export const locales = ["en", "vi"] as const;
export type Locale = (typeof locales)[number];
/** M20.14: product direction is Vietnamese-only; EN routes kept for SEO migration. */
export const defaultLocale: Locale = "vi";
export const LOCALE_COOKIE = "flr_locale";
/** Public language switcher removed (M20.14). EN routes remain reachable by URL. */
export const PUBLIC_LANGUAGE_SWITCHER = false;

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
