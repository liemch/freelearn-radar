export const locales = ["en", "vi"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "flr_locale";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
