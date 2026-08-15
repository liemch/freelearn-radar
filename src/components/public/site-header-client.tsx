"use client";

import { Menu, Search, X } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { SoftGetForm } from "@/components/navigation/soft-get-form";
import { LanguageSwitcher } from "@/components/public/language-switcher";
import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PUBLIC_LANGUAGE_SWITCHER, type Locale } from "@/lib/i18n/config";
import { stripLocalePrefix } from "@/lib/i18n/path";
import { useLocalizedPath } from "@/lib/i18n/use-locale";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

type SiteHeaderClientProps = {
  locale: Locale;
  homeHref: string;
  links: NavLink[];
  brand: React.ReactNode;
  languageLabel: string;
  menuOpenLabel: string;
  menuCloseLabel: string;
  searchPlaceholder: string;
  searchButtonLabel: string;
  showHotBadge?: boolean;
  hotBadgeLabel?: string;
};

export function SiteHeaderClient({
  locale,
  homeHref,
  links,
  brand,
  languageLabel,
  menuOpenLabel,
  menuCloseLabel,
  searchPlaceholder,
  searchButtonLabel,
  showHotBadge = false,
  hotBadgeLabel = "HOT",
}: SiteHeaderClientProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const searchAction = useLocalizedPath("/search");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function isActive(href: string): boolean {
    const { pathname: current } = stripLocalePrefix(pathname);
    const { pathname: target } = stripLocalePrefix(href);
    if (target === "/") {
      return current === "/";
    }
    return current === target || current.startsWith(`${target}/`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
      <div className="page-gutter flex items-center gap-2 py-2.5 sm:gap-3">
        <LocalizedLink
          href={homeHref}
          className="inline-flex min-w-0 shrink items-center gap-2 text-foreground transition hover:opacity-90"
          onClick={() => setOpen(false)}
        >
          {brand}
        </LocalizedLink>

        <nav
          className="hidden items-center gap-0.5 lg:flex"
          aria-label="Primary"
        >
          {links.map((link) => {
            const active = isActive(link.href);
            const isDailyFree = link.href.includes("mien-phi-hom-nay");
            return (
              <Button
                key={link.href}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  "relative font-medium",
                  active && "bg-accent text-accent-foreground",
                )}
              >
                <LocalizedLink
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                  {showHotBadge && isDailyFree ? (
                    <span className="ml-1.5 rounded bg-primary px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-primary-foreground">
                      {hotBadgeLabel}
                    </span>
                  ) : null}
                </LocalizedLink>
              </Button>
            );
          })}
        </nav>

        <SoftGetForm
          action={searchAction}
          className="ml-auto hidden min-w-0 max-w-xs flex-1 items-center gap-1 rounded-full border border-border bg-card px-2 py-1 shadow-sm md:flex lg:max-w-sm"
          role="search"
        >
          <label className="sr-only" htmlFor="header-search">
            {searchPlaceholder}
          </label>
          <Search
            className="ml-1 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="header-search"
            name="q"
            placeholder={searchPlaceholder}
            className="h-8 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="sm"
            className="h-8 shrink-0 rounded-full px-3"
          >
            {searchButtonLabel}
          </Button>
        </SoftGetForm>

        {PUBLIC_LANGUAGE_SWITCHER ? (
          <Suspense fallback={null}>
            <LanguageSwitcher
              locale={locale}
              label={languageLabel}
              className="hidden md:flex"
            />
          </Suspense>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? menuCloseLabel : menuOpenLabel}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </Button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          className="border-t border-border/60 px-4 py-3 md:hidden"
          aria-label="Mobile"
        >
          <SoftGetForm
            action={searchAction}
            className="mb-3 flex items-center gap-1 rounded-xl border border-border bg-card p-1.5"
            role="search"
          >
            <Search
              className="ml-1.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              name="q"
              placeholder={searchPlaceholder}
              className="h-10 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
              aria-label={searchPlaceholder}
            />
            <Button type="submit" size="sm" className="h-10 shrink-0 px-3">
              {searchButtonLabel}
            </Button>
          </SoftGetForm>
          <ul className="flex flex-col gap-1">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <LocalizedLink
                    href={link.href}
                    className={cn(
                      "block rounded-lg px-3 py-3 text-base font-medium hover:bg-accent",
                      active && "bg-accent",
                    )}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </LocalizedLink>
                </li>
              );
            })}
          </ul>
          {PUBLIC_LANGUAGE_SWITCHER ? (
            <Suspense fallback={null}>
              <LanguageSwitcher
                locale={locale}
                label={languageLabel}
                className="mt-3 justify-start"
              />
            </Suspense>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
