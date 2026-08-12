import Link from "next/link";

import type { Category } from "@/db/schema";
import type { Provider } from "@/db/schema";
import type { CatalogFilters } from "@/domain/course/catalog-query";

type CatalogFiltersFormProps = {
  action: string;
  filters: CatalogFilters;
  providers: Provider[];
  categories?: Category[];
  showCategoryLinks?: boolean;
};

export function CatalogFiltersForm({
  action,
  filters,
  providers,
  categories = [],
  showCategoryLinks = false,
}: CatalogFiltersFormProps) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <form action={action} method="get" className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <label className="space-y-1 text-sm md:col-span-2 lg:col-span-2">
          <span className="font-medium">Keyword</span>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search courses"
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Provider</span>
          <select
            name="provider"
            defaultValue={filters.providerSlug ?? ""}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="">All</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.slug}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Level</span>
          <select
            name="level"
            defaultValue={filters.level ?? ""}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="">All</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
            <option value="ALL_LEVELS">All levels</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Price</span>
          <select
            name="price"
            defaultValue={filters.priceType ?? ""}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="">All</option>
            <option value="FREE_FULL">100% Free</option>
            <option value="FREE_AUDIT">Free to Learn</option>
            <option value="FREE_WITH_COUPON">Coupon Required</option>
            <option value="TEMPORARILY_FREE">Temporarily Free</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Sort</span>
          <select
            name="sort"
            defaultValue={filters.sort ?? "recommended"}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="recommended">Recommended</option>
            <option value="newest">Newest</option>
            <option value="popular">Most Popular</option>
            <option value="shortest">Shortest</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            className="bg-primary text-primary-foreground inline-flex h-9 w-full items-center justify-center rounded-md px-4 text-sm font-medium"
          >
            Apply
          </button>
        </div>
      </form>

      {showCategoryLinks && categories.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/category/${category.slug}`}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent"
            >
              {category.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
