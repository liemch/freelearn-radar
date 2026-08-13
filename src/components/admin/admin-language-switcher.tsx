"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { locales, type Locale } from "@/lib/i18n/config";
import { setLocalePreferenceCookie } from "@/lib/i18n/path";
import { cn } from "@/lib/utils";

type AdminLanguageSwitcherProps = {
  locale: Locale;
  label: string;
  className?: string;
};

const LOCALE_LABELS: Record<Locale, string> = { en: "EN", vi: "VI" };

/**
 * Admin routes have no locale prefix, so switching writes the preference
 * cookie and refreshes so server components re-render with the new locale.
 */
export function AdminLanguageSwitcher({
  locale,
  label,
  className,
}: AdminLanguageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onSelect(next: Locale) {
    if (next === locale) return;
    setLocalePreferenceCookie(next);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="group"
      aria-label={label}
    >
      {locales.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            disabled={isPending}
            aria-current={active ? "true" : undefined}
            onClick={() => onSelect(code)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-60",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {LOCALE_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
