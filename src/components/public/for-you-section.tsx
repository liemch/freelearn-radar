"use client";

import { useEffect, useMemo, useState } from "react";

import { CourseGrid } from "@/components/public/course-grid";
import { InterestPicker } from "@/components/public/interest-picker";
import { Button } from "@/components/ui/button";
import type { CourseWithProvider } from "@/db/repositories/course-repository";
import {
  type InterestSlug,
  readInterestsFromStorage,
  softRankByInterests,
} from "@/domain/discovery/interests";
import type { Locale } from "@/lib/i18n/config";

type ForYouLabels = {
  title: string;
  subtitle: string;
  pickCta: string;
  change: string;
  emptyRanked: string;
  interestsTitle: string;
  interestsDescription: string;
  save: string;
  saved: string;
};

export type ForYouCourseItem = {
  course: CourseWithProvider;
  categorySlugs: string[];
};

type RankableItem = ForYouCourseItem & { id: string };

type ForYouSectionProps = {
  enabled: boolean;
  locale: Locale;
  items: ForYouCourseItem[];
  labels: ForYouLabels;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** RSC serializes Dates to strings; CourseCard freshness needs real Dates. */
function reviveCourse(course: CourseWithProvider): CourseWithProvider {
  return {
    ...course,
    lastVerifiedAt: asDate(course.lastVerifiedAt),
    publishedAt: asDate(course.publishedAt),
  };
}

export function ForYouSection({
  enabled,
  locale,
  items,
  labels,
}: ForYouSectionProps) {
  const [interests, setInterests] = useState<InterestSlug[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const stored = readInterestsFromStorage(
      typeof window !== "undefined" ? window.localStorage : null,
    );
    setInterests(stored);
    setShowPicker(stored.length === 0);
    setHydrated(true);
  }, [enabled]);

  const ranked = useMemo(() => {
    if (interests.length === 0) return [];
    const rankable: RankableItem[] = items.map((item) => ({
      ...item,
      id: item.course.id,
    }));
    return softRankByInterests(
      rankable,
      (item) => item.categorySlugs,
      interests,
    )
      .slice(0, 6)
      .map((item) => reviveCourse(item.course));
  }, [items, interests]);

  if (!enabled) return null;

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {labels.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
        </div>
        {hydrated && interests.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setShowPicker((value) => !value)}
          >
            {labels.change}
          </Button>
        ) : null}
      </div>

      {!hydrated ? (
        <div className="h-24 animate-pulse rounded-xl border border-border/50 bg-muted/40" />
      ) : showPicker || interests.length === 0 ? (
        <div className="space-y-3">
          {interests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.pickCta}</p>
          ) : null}
          <InterestPicker
            enabled={enabled}
            title={labels.interestsTitle}
            description={labels.interestsDescription}
            saveLabel={labels.save}
            savedLabel={labels.saved}
            onChange={(slugs) => {
              setInterests(slugs);
              if (slugs.length > 0) setShowPicker(false);
            }}
          />
        </div>
      ) : ranked.length > 0 ? (
        <CourseGrid courses={ranked} locale={locale} />
      ) : (
        <p className="text-sm text-muted-foreground">{labels.emptyRanked}</p>
      )}
    </section>
  );
}
