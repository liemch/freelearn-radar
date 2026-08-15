"use client";

import { Search } from "lucide-react";

import { SoftGetForm } from "@/components/navigation/soft-get-form";
import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n/types";
import { useLocalizedPath } from "@/lib/i18n/use-locale";

type HomeHeroProps = {
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    searchPlaceholder: string;
    searchButton: string;
    topicShortcuts: string;
  };
  topics: { href: string; label: string }[];
  heroImageUrl?: string | null;
  heroImageAlt?: string;
};

/**
 * M22.0 hero: left copy + search, right Admin banner when present.
 * Without a banner the layout collapses gracefully to a single column.
 */
export function HomeHero({
  hero,
  topics,
  heroImageUrl,
  heroImageAlt = "FreeLearn Radar",
}: HomeHeroProps) {
  const searchAction = useLocalizedPath("/search");

  return (
    <section className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-accent/40 via-surface to-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.92_0.05_160/0.55),transparent_55%)]"
      />
      <div className="page-gutter relative grid gap-8 py-8 sm:gap-10 sm:py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12 lg:py-14">
        <div className="space-y-5 sm:space-y-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary sm:text-xs">
            {hero.eyebrow}
          </p>
          <h1 className="font-display text-[2rem] font-semibold leading-[1.12] text-balance sm:text-5xl lg:text-[3.25rem]">
            {hero.headline}
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
            {hero.subhead}
          </p>

          <SoftGetForm
            action={searchAction}
            className="flex flex-col gap-2 rounded-2xl bg-card p-2 shadow-card ring-1 ring-border/80 transition focus-within:ring-2 focus-within:ring-primary/45 sm:flex-row sm:items-center"
            role="search"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <label className="sr-only" htmlFor="home-search">
                {hero.searchPlaceholder}
              </label>
              <Search
                className="ml-2 size-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="home-search"
                name="q"
                placeholder={hero.searchPlaceholder}
                className="h-12 flex-1 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
              />
            </div>
            <Button
              type="submit"
              className="h-12 w-full shrink-0 rounded-xl px-7 text-base sm:w-auto"
            >
              {hero.searchButton}
            </Button>
          </SoftGetForm>

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm">
            <span className="mr-1 text-sm text-muted-foreground">
              {hero.topicShortcuts}
            </span>
            {topics.map((topic) => (
              <LocalizedLink
                key={topic.href}
                href={topic.href}
                className="rounded-full border border-border/80 bg-card/90 px-3 py-1.5 text-sm font-medium shadow-sm transition hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
              >
                {topic.label}
              </LocalizedLink>
            ))}
          </div>
        </div>

        {heroImageUrl ? (
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImageUrl}
                alt={heroImageAlt}
                className="aspect-[4/3] w-full object-cover object-center sm:aspect-[5/4]"
              />
            </div>
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="relative mx-auto hidden w-full max-w-md lg:block"
          >
            <div className="flex aspect-[4/3] items-end justify-center overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-primary/15 via-card to-accent p-8 shadow-card">
              <div className="space-y-3 text-center">
                <p className="font-display text-3xl font-semibold text-primary">
                  FreeLearn Radar
                </p>
                <p className="text-sm text-muted-foreground">
                  Tuyển chọn · Xác minh · Học miễn phí
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// Keep Dictionary type import usable for callers that pass dict.hero.
export type HomeHeroDict = Dictionary["hero"];
