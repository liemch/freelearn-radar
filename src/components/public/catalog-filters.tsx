"use client";

import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category } from "@/db/schema";
import type { Provider } from "@/db/schema";
import type { CatalogFilters } from "@/domain/course/catalog-query";
import {
  DURATION_BUCKETS,
  durationBucketLabel,
} from "@/domain/course/catalog-query";
import {
  formatLevelLabel,
  getCertificateTypeLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";
import type { Locale } from "@/lib/i18n/config";
import { useCurrentLocale, useLocalizedPath } from "@/lib/i18n/use-locale";
import { cn } from "@/lib/utils";

type CatalogFiltersFormProps = {
  /** Locale-less or locale-prefixed action path (e.g. `/search`). */
  action: string;
  filters: CatalogFilters;
  providers: Provider[];
  categories?: Category[];
  showCategoryLinks?: boolean;
  labels?: CatalogFilterLabels;
};

export type CatalogFilterLabels = {
  filters: string;
  active: string;
  keyword: string;
  keywordPlaceholder: string;
  provider: string;
  level: string;
  freeType: string;
  certificate: string;
  duration: string;
  sort: string;
  all: string;
  any: string;
  apply: string;
  clearAll: string;
  filtersActive: string;
  categories: string;
  sortRecommended: string;
  sortNewest: string;
  sortPopular: string;
  sortShortest: string;
  levelBeginner: string;
  levelIntermediate: string;
  levelAdvanced: string;
  levelAll: string;
  /**
   * Accessible name for a chip's remove control. A template, not a function:
   * this whole object is serialised across the server/client boundary, and a
   * function silently turns every page carrying filters into a 500.
   * Placeholder: {label}
   */
  removeFilter: string;
};

const DEFAULT_LABELS: CatalogFilterLabels = {
  filters: "Filters",
  active: "Active",
  keyword: "Keyword",
  keywordPlaceholder: "Search courses",
  provider: "Provider",
  level: "Level",
  freeType: "Free type",
  certificate: "Certificate",
  duration: "Duration",
  sort: "Sort",
  all: "All",
  any: "Any",
  apply: "Apply",
  clearAll: "Clear all",
  filtersActive: "Filters active",
  categories: "Categories",
  sortRecommended: "Recommended",
  sortNewest: "Newest",
  sortPopular: "Most Popular",
  sortShortest: "Shortest",
  levelBeginner: "Beginner",
  levelIntermediate: "Intermediate",
  levelAdvanced: "Advanced",
  levelAll: "All levels",
  removeFilter: "Remove filter: {label}",
};

/** Compact control: still 44px tall on touch, tightened on pointer devices. */
const FIELD =
  "border-input bg-background flex h-11 w-full rounded-md border px-2.5 text-base shadow-xs sm:h-9 sm:text-sm";

const FIELD_LABEL =
  "block text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground";

type FilterKey =
  | "q"
  | "provider"
  | "level"
  | "price"
  | "certificate"
  | "durationMax"
  | "sort";

function toQuery(filters: CatalogFilters): Record<FilterKey, string> {
  return {
    q: filters.q ?? "",
    provider: filters.providerSlug ?? "",
    level: filters.level ?? "",
    price: filters.priceType ?? "",
    certificate: filters.certificateType ?? "",
    durationMax:
      filters.durationMaxMinutes != null
        ? String(filters.durationMaxMinutes)
        : "",
    sort: filters.sort && filters.sort !== "recommended" ? filters.sort : "",
  };
}

function hasActiveFilters(filters: CatalogFilters): boolean {
  return Object.values(toQuery(filters)).some(Boolean);
}

/** The current URL minus one filter, so a chip can remove just itself. */
function hrefWithout(
  action: string,
  filters: CatalogFilters,
  omit: FilterKey,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(toQuery(filters))) {
    if (value && key !== omit) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${action}?${query}` : action;
}

export function CatalogFiltersForm({
  action,
  filters,
  providers,
  categories = [],
  showCategoryLinks = false,
  labels: labelsProp,
}: CatalogFiltersFormProps) {
  const locale = useCurrentLocale();
  const localizedAction = useLocalizedPath(action);
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const hasActive = hasActiveFilters(filters);
  const [open, setOpen] = useState(hasActive);

  const durationValue =
    filters.durationMaxMinutes != null
      ? String(filters.durationMaxMinutes)
      : "";

  const chips = buildChips(filters, providers, labels, locale);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            className="flex min-h-11 flex-1 items-center justify-between gap-3 rounded-lg bg-secondary/70 px-3 py-2.5 text-left text-sm font-semibold"
            aria-expanded={open}
            aria-controls="catalog-filters-panel"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="inline-flex items-center gap-2">
              {labels.filters}
              {hasActive ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {chips.length}
                </span>
              ) : null}
            </span>
            <ChevronDown
              className={cn(
                "size-5 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
        </div>

        <div
          id="catalog-filters-panel"
          className={cn("space-y-4", !open && "hidden sm:block")}
        >
          {/*
            One row on a wide screen, wrapping to two or three on narrower ones.
            Keyword gets the extra width because it is the field people reach for.
          */}
          <form
            action={localizedAction}
            method="get"
            // Seven fields plus the submit button: the xl template needs eight
            // tracks, or the button wraps onto a row of its own.
            className="mt-3 grid items-end gap-2.5 sm:mt-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[1.5fr_repeat(6,1fr)_auto]"
          >
            <label className="space-y-1 sm:col-span-3 lg:col-span-1 xl:col-span-1">
              <span className={FIELD_LABEL}>{labels.keyword}</span>
              <Input
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder={labels.keywordPlaceholder}
                className="h-11 text-base sm:h-9 sm:text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className={FIELD_LABEL}>{labels.provider}</span>
              <select
                name="provider"
                defaultValue={filters.providerSlug ?? ""}
                className={FIELD}
              >
                <option value="">{labels.all}</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.slug}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className={FIELD_LABEL}>{labels.level}</span>
              <select
                name="level"
                defaultValue={filters.level ?? ""}
                className={FIELD}
              >
                <option value="">{labels.all}</option>
                <option value="BEGINNER">{labels.levelBeginner}</option>
                <option value="INTERMEDIATE">{labels.levelIntermediate}</option>
                <option value="ADVANCED">{labels.levelAdvanced}</option>
                <option value="ALL_LEVELS">{labels.levelAll}</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className={FIELD_LABEL}>{labels.freeType}</span>
              <select
                name="price"
                defaultValue={filters.priceType ?? ""}
                className={FIELD}
              >
                <option value="">{labels.all}</option>
                <PriceOptions locale={locale} />
              </select>
            </label>

            <label className="space-y-1">
              <span className={FIELD_LABEL}>{labels.certificate}</span>
              <select
                name="certificate"
                defaultValue={filters.certificateType ?? ""}
                className={FIELD}
              >
                <option value="">{labels.all}</option>
                <option value="FREE_CERTIFICATE">
                  {getCertificateTypeLabel("FREE_CERTIFICATE", locale)}
                </option>
                <option value="PAID_CERTIFICATE">
                  {getCertificateTypeLabel("PAID_CERTIFICATE", locale)}
                </option>
                <option value="NO_CERTIFICATE">
                  {getCertificateTypeLabel("NO_CERTIFICATE", locale)}
                </option>
              </select>
            </label>

            <label className="space-y-1">
              <span className={FIELD_LABEL}>{labels.duration}</span>
              <select
                name="durationMax"
                defaultValue={durationValue}
                className={FIELD}
              >
                <option value="">{labels.any}</option>
                {Object.values(DURATION_BUCKETS).map((bucket) => (
                  <option key={bucket.slug} value={String(bucket.maxMinutes)}>
                    {durationBucketLabel(bucket, locale)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className={FIELD_LABEL}>{labels.sort}</span>
              <select
                name="sort"
                defaultValue={filters.sort ?? "recommended"}
                className={FIELD}
              >
                <option value="recommended">{labels.sortRecommended}</option>
                <option value="newest">{labels.sortNewest}</option>
                <option value="popular">{labels.sortPopular}</option>
                <option value="shortest">{labels.sortShortest}</option>
              </select>
            </label>

            <div className="sm:col-span-3 lg:col-span-1 xl:col-span-1">
              <Button
                type="submit"
                className="h-11 min-h-11 w-full sm:h-9 sm:min-h-9"
              >
                {labels.apply}
              </Button>
            </div>
          </form>

          {showCategoryLinks && categories.length > 0 ? (
            <nav
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
              aria-label={labels.categories}
            >
              {categories.map((category) => (
                <LocalizedLink
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="shrink-0 rounded-full bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-accent sm:py-1.5"
                >
                  {category.name}
                </LocalizedLink>
              ))}
            </nav>
          ) : null}
        </div>
      </div>

      {/*
        Chips live outside the panel so they stay visible on mobile when the
        filter drawer is collapsed — otherwise a narrowed result set has no
        visible explanation.
      */}
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {labels.filtersActive}
          </span>
          {chips.map((chip) => (
            <LocalizedLink
              key={chip.key}
              href={hrefWithout(action, filters, chip.key)}
              aria-label={labels.removeFilter.replace("{label}", chip.label)}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-2.5 pr-2 text-xs font-medium transition hover:border-primary/40 hover:bg-accent"
            >
              {chip.label}
              <X
                className="size-3 text-muted-foreground transition group-hover:text-foreground"
                aria-hidden="true"
              />
            </LocalizedLink>
          ))}
          <LocalizedLink
            href={action}
            className="rounded-full px-2 py-1 text-xs font-medium text-primary hover:underline"
          >
            {labels.clearAll}
          </LocalizedLink>
        </div>
      ) : null}
    </div>
  );
}

type Chip = { key: FilterKey; label: string };

function buildChips(
  filters: CatalogFilters,
  providers: Provider[],
  labels: CatalogFilterLabels,
  locale: Locale,
): Chip[] {
  const chips: Chip[] = [];

  if (filters.q) {
    chips.push({ key: "q", label: `“${filters.q}”` });
  }

  if (filters.providerSlug) {
    const provider = providers.find(
      (item) => item.slug === filters.providerSlug,
    );
    chips.push({ key: "provider", label: provider?.name ?? filters.providerSlug });
  }

  if (filters.level) {
    chips.push({ key: "level", label: formatLevelLabel(filters.level, locale) });
  }

  if (filters.priceType) {
    chips.push({
      key: "price",
      label: getPriceTypeLabel(filters.priceType, locale).label,
    });
  }

  if (filters.certificateType) {
    chips.push({
      key: "certificate",
      label: getCertificateTypeLabel(filters.certificateType, locale),
    });
  }

  if (filters.durationMaxMinutes != null) {
    const bucket = Object.values(DURATION_BUCKETS).find(
      (item) => item.maxMinutes === filters.durationMaxMinutes,
    );
    chips.push({
      key: "durationMax",
      label: bucket
        ? durationBucketLabel(bucket, locale)
        : `${labels.duration}: ${filters.durationMaxMinutes}`,
    });
  }

  if (filters.sort && filters.sort !== "recommended") {
    const sortLabels: Record<string, string> = {
      newest: labels.sortNewest,
      popular: labels.sortPopular,
      shortest: labels.sortShortest,
    };
    chips.push({
      key: "sort",
      label: sortLabels[filters.sort] ?? filters.sort,
    });
  }

  return chips;
}

function PriceOptions({ locale }: { locale: Locale }) {
  return (
    <>
      <option value="FREE_FULL">
        {getPriceTypeLabel("FREE_FULL", locale).label}
      </option>
      <option value="FREE_AUDIT">
        {getPriceTypeLabel("FREE_AUDIT", locale).label}
      </option>
      <option value="FREE_WITH_COUPON">
        {getPriceTypeLabel("FREE_WITH_COUPON", locale).label}
      </option>
      <option value="TEMPORARILY_FREE">
        {getPriceTypeLabel("TEMPORARILY_FREE", locale).label}
      </option>
    </>
  );
}
