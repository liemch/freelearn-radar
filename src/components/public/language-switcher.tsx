"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { Locale } from "@/lib/i18n/config";
import { locales } from "@/lib/i18n/config";
import {
  setLocalePreferenceCookie,
  switchLocalePath,
} from "@/lib/i18n/path";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  locale: Locale;
  label: string;
  className?: string;
};

export function LanguageSwitcher({
  locale,
  label,
  className,
}: LanguageSwitcherProps) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const search = searchParams?.toString();
  const current = search ? `${pathname}?${search}` : pathname;

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="group"
      aria-label={label}
    >
      {locales.map((code) => {
        const active = code === locale;
        const href = switchLocalePath(current, code);
        return (
          <Link
            key={code}
            href={href}
            prefetch
            onClick={() => {
              setLocalePreferenceCookie(code);
            }}
            className={cn(
              "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={active ? "true" : undefined}
            lang={code}
            hrefLang={code}
          >
            {code}
          </Link>
        );
      })}
    </div>
  );
}
