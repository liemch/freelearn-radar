import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

export function localePath(locale: Locale, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") {
    return `/${locale}`;
  }
  return `/${locale}${normalized}`;
}

export function stripLocalePrefix(pathname: string): {
  locale: Locale;
  pathname: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && isLocale(first)) {
    const rest = segments.slice(1).join("/");
    return { locale: first, pathname: rest ? `/${rest}` : "/" };
  }
  return { locale: defaultLocale, pathname: pathname || "/" };
}

export function switchLocalePath(pathname: string, targetLocale: Locale): string {
  const { pathname: stripped } = stripLocalePrefix(pathname);
  return localePath(targetLocale, stripped);
}
