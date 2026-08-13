"use client";

import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category } from "@/db/schema";
import type { Provider } from "@/db/schema";
import type { CatalogFilters } from "@/domain/course/catalog-query";
import { DURATION_BUCKETS } from "@/domain/course/catalog-query";
import {
  getCertificateTypeLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";
import type { Locale } from "@/lib/i18n/config";
import { useCurrentLocale, useLocalizedPath } from "@/lib/i18n/use-locale";

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
};

const FIELD =
  "border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm shadow-xs";

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

  const durationValue =
    filters.durationMaxMinutes != null
      ? String(filters.durationMaxMinutes)
      : "";

  const hasActive =
    Boolean(filters.q) ||
    Boolean(filters.providerSlug) ||
    Boolean(filters.level) ||
    Boolean(filters.priceType) ||
    Boolean(filters.certificateType) ||
    Boolean(filters.durationMaxMinutes) ||
    (filters.sort != null && filters.sort !== "recommended");

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <p className="text-sm font-semibold sm:hidden">
        {labels.filters}
        {hasActive ? (
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {labels.active}
          </span>
        ) : null}
      </p>

      <form
        action={localizedAction}
        method="get"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"
      >
        <label className="space-y-1.5 text-sm sm:col-span-2 xl:col-span-2">
          <span className="font-medium">{labels.keyword}</span>
          <Input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder={labels.keywordPlaceholder}
            className="h-10"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{labels.provider}</span>
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

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{labels.level}</span>
          <select name="level" defaultValue={filters.level ?? ""} className={FIELD}>
            <option value="">{labels.all}</option>
            <option value="BEGINNER">{labels.levelBeginner}</option>
            <option value="INTERMEDIATE">{labels.levelIntermediate}</option>
            <option value="ADVANCED">{labels.levelAdvanced}</option>
            <option value="ALL_LEVELS">{labels.levelAll}</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{labels.freeType}</span>
          <select
            name="price"
            defaultValue={filters.priceType ?? ""}
            className={FIELD}
          >
            <option value="">{labels.all}</option>
            <PriceOptions locale={locale} />
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{labels.certificate}</span>
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

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{labels.duration}</span>
          <select
            name="durationMax"
            defaultValue={durationValue}
            className={FIELD}
          >
            <option value="">{labels.any}</option>
            <option value={String(DURATION_BUCKETS.under_1h.maxMinutes)}>
              {DURATION_BUCKETS.under_1h.label}
            </option>
            <option value={String(DURATION_BUCKETS.under_5h.maxMinutes)}>
              {DURATION_BUCKETS.under_5h.label}
            </option>
            <option value={String(DURATION_BUCKETS.weekend.maxMinutes)}>
              {DURATION_BUCKETS.weekend.label}
            </option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{labels.sort}</span>
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

        <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-1">
          <Button type="submit" className="h-10 min-h-10 w-full">
            {labels.apply}
          </Button>
        </div>
      </form>

      {hasActive ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{labels.filtersActive}</span>
          <Button asChild variant="ghost" size="sm">
            <LocalizedLink href={action}>{labels.clearAll}</LocalizedLink>
          </Button>
        </div>
      ) : null}

      {showCategoryLinks && categories.length > 0 ? (
        <nav className="flex flex-wrap gap-2" aria-label={labels.categories}>
          {categories.map((category) => (
            <LocalizedLink
              key={category.id}
              href={`/category/${category.slug}`}
              className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent"
            >
              {category.name}
            </LocalizedLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
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
