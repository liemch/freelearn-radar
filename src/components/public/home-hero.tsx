"use client";

import { Search } from "lucide-react";

import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";
import { useLocalizedPath } from "@/lib/i18n/use-locale";

type HomeHeroProps = {
  locale: Locale;
  dict: Dictionary;
  topics: { href: string; label: string }[];
};

export function HomeHero({ dict, topics }: HomeHeroProps) {
  const searchAction = useLocalizedPath("/search");

  return (
    <section className="border-b border-border/50 bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-end lg:gap-10">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {dict.hero.eyebrow}
          </p>
          <h1 className="font-display text-3xl font-semibold leading-tight text-balance sm:text-4xl">
            {dict.hero.headline}
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty">
            {dict.hero.subhead}
          </p>
        </div>

        <div className="space-y-3">
          <form
            action={searchAction}
            method="get"
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-sm"
            role="search"
          >
            <label className="sr-only" htmlFor="home-search">
              {dict.hero.searchPlaceholder}
            </label>
            <Search
              className="ml-2 size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="home-search"
              name="q"
              placeholder={dict.hero.searchPlaceholder}
              className="h-10 flex-1 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            />
            <Button type="submit" className="h-10 shrink-0 px-5">
              {dict.hero.searchButton}
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium text-muted-foreground">
              {dict.hero.trending}:
            </span>
            {topics.map((topic, index) => (
              <span key={topic.href} className="inline-flex items-center">
                {index > 0 ? (
                  <span aria-hidden="true" className="mx-1.5 text-border">
                    ·
                  </span>
                ) : null}
                <LocalizedLink
                  href={topic.href}
                  className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {topic.label}
                </LocalizedLink>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
