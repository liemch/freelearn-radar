"use client";

import { Search } from "lucide-react";

import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n/types";
import { useLocalizedPath } from "@/lib/i18n/use-locale";

type HomeHeroProps = {
  hero: Dictionary["hero"];
  topics: { href: string; label: string }[];
};

export function HomeHero({ hero, topics }: HomeHeroProps) {
  const searchAction = useLocalizedPath("/search");

  return (
    <section className="border-b border-border/50 bg-surface">
      {/*
        Kept deliberately short: the brief is a discovery product, so the first
        screen should reach the start of the catalogue, not end at a headline.
      */}
      <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-7 sm:gap-6 sm:px-6 sm:py-9 lg:grid-cols-[1fr_minmax(0,440px)] lg:items-end lg:gap-10">
        <div className="space-y-2.5 sm:space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-xs">
            {hero.eyebrow}
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-[1.15] text-balance sm:text-4xl">
            {hero.headline}
          </h1>
          <p className="max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty sm:text-base">
            {hero.subhead}
          </p>
        </div>

        <div className="space-y-3">
          {/*
            The search field is the page's primary action, so it carries a ring
            rather than a hairline border and grows a focus ring as one unit —
            the whole control reads as the target, not just the text input.
          */}
          <form
            action={searchAction}
            method="get"
            className="flex flex-col gap-2 rounded-xl bg-card p-2 shadow-sm ring-1 ring-border transition focus-within:ring-2 focus-within:ring-primary/50 sm:flex-row sm:items-center sm:gap-2 sm:p-2"
            role="search"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <label className="sr-only" htmlFor="home-search">
                {hero.searchPlaceholder}
              </label>
              <Search
                className="ml-1.5 size-5 shrink-0 text-muted-foreground sm:ml-2"
                aria-hidden="true"
              />
              <Input
                id="home-search"
                name="q"
                placeholder={hero.searchPlaceholder}
                className="h-11 flex-1 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full shrink-0 px-6 sm:w-auto"
            >
              {hero.searchButton}
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-sm">
            <span className="mr-0.5 text-sm text-muted-foreground">
              {hero.topicShortcuts}
            </span>
            {topics.map((topic) => (
              <LocalizedLink
                key={topic.href}
                href={topic.href}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-sm font-medium transition hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
              >
                {topic.label}
              </LocalizedLink>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
