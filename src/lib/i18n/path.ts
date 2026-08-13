import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/lib/i18n/config";

const SKIP_PREFIXES = ["/admin", "/api", "/_next"];

function shouldSkipLocalization(pathname: string): boolean {
  if (pathname.includes("/go")) {
    return true;
  }
  return SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Build a locale-prefixed path. `path` should be locale-less (e.g. `/search`).
 * Query strings and hashes on `path` are preserved.
 */
export function localePath(locale: Locale, path: string): string {
  const url = new URL(path, "http://local.invalid");
  let pathname = url.pathname;
  if (!pathname.startsWith("/")) {
    pathname = `/${pathname}`;
  }

  const localized =
    pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;

  return `${localized}${url.search}${url.hash}`;
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

/**
 * Re-bind any internal public href to `locale`.
 * Strips an existing /en|/vi prefix first so stale `/en/...` props
 * cannot override the user's current locale.
 */
export function localizeHref(href: string, locale: Locale): string {
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("//")
  ) {
    return href;
  }

  if (!href.startsWith("/")) {
    return href;
  }

  const url = new URL(href, "http://local.invalid");
  if (shouldSkipLocalization(url.pathname)) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  const { pathname: stripped } = stripLocalePrefix(url.pathname);
  return `${localePath(locale, stripped)}${url.search === "" ? "" : url.search}${url.hash}`;
}

/**
 * Switch locale while preserving path + query + hash.
 * Accepts pathname-only or pathname+search (e.g. `/vi/search?q=python`).
 */
export function switchLocalePath(
  pathnameWithSearch: string,
  targetLocale: Locale,
): string {
  return localizeHref(pathnameWithSearch, targetLocale);
}

export function localeCookieHeader(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function setLocalePreferenceCookie(locale: Locale): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = localeCookieHeader(locale);
}
