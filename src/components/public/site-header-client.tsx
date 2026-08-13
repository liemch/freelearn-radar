"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";

import { LanguageSwitcher } from "@/components/public/language-switcher";
import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { stripLocalePrefix } from "@/lib/i18n/path";
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
};

export function SiteHeaderClient({
  locale,
  homeHref,
  links,
  brand,
  languageLabel,
  menuOpenLabel,
  menuCloseLabel,
}: SiteHeaderClientProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";

  function isActive(href: string): boolean {
    const { pathname: current } = stripLocalePrefix(pathname);
    const { pathname: target } = stripLocalePrefix(href);
    if (target === "/") {
      return current === "/";
    }
    return current === target || current.startsWith(`${target}/`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <LocalizedLink
          href={homeHref}
          className="inline-flex min-w-0 flex-1 items-center gap-2 text-foreground transition hover:opacity-90 md:flex-none"
        >
          {brand}
        </LocalizedLink>

        <nav
          className="hidden items-center gap-0.5 md:flex"
          aria-label="Primary"
        >
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <Button
                key={link.href}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  "font-medium",
                  active && "bg-accent text-accent-foreground",
                )}
              >
                <LocalizedLink
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </LocalizedLink>
              </Button>
            );
          })}
        </nav>

        <Suspense fallback={null}>
          <LanguageSwitcher
            locale={locale}
            label={languageLabel}
            className="hidden md:flex"
          />
        </Suspense>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? menuCloseLabel : menuOpenLabel}
        </Button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          className="border-t border-border/60 px-4 py-3 md:hidden"
          aria-label="Mobile"
        >
          <ul className="flex flex-col gap-1">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <LocalizedLink
                    href={link.href}
                    className={cn(
                      "block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent",
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
          <Suspense fallback={null}>
            <LanguageSwitcher
              locale={locale}
              label={languageLabel}
              className="mt-3 justify-start"
            />
          </Suspense>
        </nav>
      ) : null}
    </header>
  );
}
