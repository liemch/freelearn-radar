import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category } from "@/db/schema";
import type { Provider } from "@/db/schema";
import type { CatalogFilters } from "@/domain/course/catalog-query";
import { DURATION_BUCKETS } from "@/domain/course/catalog-query";
import {
  CERTIFICATE_TYPE_LABELS,
  PRICE_TYPE_LABELS,
} from "@/domain/course/labels";

type CatalogFiltersFormProps = {
  action: string;
  filters: CatalogFilters;
  providers: Provider[];
  categories?: Category[];
  showCategoryLinks?: boolean;
};

const FIELD =
  "border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm shadow-xs";

export function CatalogFiltersForm({
  action,
  filters,
  providers,
  categories = [],
  showCategoryLinks = false,
}: CatalogFiltersFormProps) {
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
        Filters
        {hasActive ? (
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Active
          </span>
        ) : null}
      </p>

      <form
        action={action}
        method="get"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"
      >
        <label className="space-y-1.5 text-sm sm:col-span-2 xl:col-span-2">
          <span className="font-medium">Keyword</span>
          <Input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search courses"
            className="h-10"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Provider</span>
          <select
            name="provider"
            defaultValue={filters.providerSlug ?? ""}
            className={FIELD}
          >
            <option value="">All</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.slug}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Level</span>
          <select name="level" defaultValue={filters.level ?? ""} className={FIELD}>
            <option value="">All</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
            <option value="ALL_LEVELS">All levels</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Free type</span>
          <select
            name="price"
            defaultValue={filters.priceType ?? ""}
            className={FIELD}
          >
            <option value="">All</option>
            <option value="FREE_FULL">{PRICE_TYPE_LABELS.FREE_FULL.label}</option>
            <option value="FREE_AUDIT">{PRICE_TYPE_LABELS.FREE_AUDIT.label}</option>
            <option value="FREE_WITH_COUPON">
              {PRICE_TYPE_LABELS.FREE_WITH_COUPON.label}
            </option>
            <option value="TEMPORARILY_FREE">
              {PRICE_TYPE_LABELS.TEMPORARILY_FREE.label}
            </option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Certificate</span>
          <select
            name="certificate"
            defaultValue={filters.certificateType ?? ""}
            className={FIELD}
          >
            <option value="">All</option>
            <option value="FREE_CERTIFICATE">
              {CERTIFICATE_TYPE_LABELS.FREE_CERTIFICATE}
            </option>
            <option value="PAID_CERTIFICATE">
              {CERTIFICATE_TYPE_LABELS.PAID_CERTIFICATE}
            </option>
            <option value="NO_CERTIFICATE">
              {CERTIFICATE_TYPE_LABELS.NO_CERTIFICATE}
            </option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Duration</span>
          <select
            name="durationMax"
            defaultValue={durationValue}
            className={FIELD}
          >
            <option value="">Any</option>
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
          <span className="font-medium">Sort</span>
          <select
            name="sort"
            defaultValue={filters.sort ?? "recommended"}
            className={FIELD}
          >
            <option value="recommended">Recommended</option>
            <option value="newest">Newest</option>
            <option value="popular">Most Popular</option>
            <option value="shortest">Shortest</option>
          </select>
        </label>

        <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-1">
          <Button type="submit" className="h-10 min-h-10 w-full">
            Apply
          </Button>
        </div>
      </form>

      {hasActive ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filters active</span>
          <Button asChild variant="ghost" size="sm">
            <Link href={action}>Clear all</Link>
          </Button>
        </div>
      ) : null}

      {showCategoryLinks && categories.length > 0 ? (
        <nav className="flex flex-wrap gap-2" aria-label="Categories">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
