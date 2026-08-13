"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "@/lib/i18n/config";
import { locales } from "@/lib/i18n/config";
import { switchLocalePath } from "@/lib/i18n/path";
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
  const pathname = usePathname();

  return (
    <div className={cn("flex items-center gap-1", className)} role="group" aria-label={label}>
      {locales.map((code) => {
        const active = code === locale;
        return (
          <Link
            key={code}
            href={switchLocalePath(pathname, code)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide transition",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={active ? "true" : undefined}
            lang={code}
          >
            {code}
          </Link>
        );
      })}
    </div>
  );
}
