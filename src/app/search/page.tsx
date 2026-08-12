import type { Metadata } from "next";

import { CatalogFiltersForm } from "@/components/public/catalog-filters";
import { CourseCard } from "@/components/public/course-card";
import { EmptyState } from "@/components/public/empty-state";
import { Pagination } from "@/components/public/pagination";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { listCategories } from "@/db/repositories/category-repository";
import { queryCatalog } from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { buildCatalogQuery } from "@/domain/course/catalog-query";
import { withDb } from "@/lib/db-safe";

export const metadata: Metadata = {
  title: "Search Free Courses | FreeLearn Radar",
  description: "Search curated free online courses by keyword, provider, and level.",
};

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const raw = await searchParams;
  const urlParams = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      urlParams.set(key, value);
    }
  }

  const filters = buildCatalogQuery(urlParams);

  const [catalog, providers, categories] = await Promise.all([
    withDb(
      "search.catalog",
      (db) => queryCatalog(db, filters),
      {
        items: [],
        total: 0,
        page: 1,
        pageSize: filters.pageSize ?? 12,
        totalPages: 1,
      },
    ),
    withDb("search.providers", (db) => listProviders(db), []),
    withDb("search.categories", (db) => listCategories(db), []),
  ]);

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Search courses</h1>
          <p className="text-muted-foreground">
            Filter by provider, level, price type, and sort order.
          </p>
          <p className="text-sm text-muted-foreground">
            {catalog.total} result{catalog.total === 1 ? "" : "s"}
            {filters.q ? ` for “${filters.q}”` : ""}
          </p>
        </div>

        <CatalogFiltersForm
          action="/search"
          filters={filters}
          providers={providers}
          categories={categories}
          showCategoryLinks
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title="No courses found"
            description="Try a broader keyword or clear filters."
            actionHref="/"
            actionLabel="Back to home"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        <Pagination
          page={catalog.page}
          totalPages={catalog.totalPages}
          basePath="/search"
          query={{
            q: filters.q,
            provider: filters.providerSlug,
            level: filters.level,
            price: filters.priceType,
            sort: filters.sort,
          }}
        />
      </div>
      <SiteFooter />
    </main>
  );
}
