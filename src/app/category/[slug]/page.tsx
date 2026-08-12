import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogFiltersForm } from "@/components/public/catalog-filters";
import { CourseCard } from "@/components/public/course-card";
import { EmptyState } from "@/components/public/empty-state";
import { Pagination } from "@/components/public/pagination";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { findCategoryBySlug, listCategories } from "@/db/repositories/category-repository";
import { queryCatalog } from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { buildCatalogQuery } from "@/domain/course/catalog-query";
import { withDb } from "@/lib/db-safe";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await withDb(
    "category.metadata",
    (db) => findCategoryBySlug(db, slug),
    null,
  );

  return {
    title: category
      ? `${category.name} Free Courses | FreeLearn Radar`
      : "Category not found",
    description: category?.description ?? undefined,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const raw = await searchParams;
  const urlParams = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      urlParams.set(key, value);
    }
  }

  const filters = buildCatalogQuery(urlParams);

  const category = await withDb(
    "category.find",
    (db) => findCategoryBySlug(db, slug),
    null,
  );

  if (!category) {
    notFound();
  }

  const [catalog, providers, categories] = await Promise.all([
    withDb(
      "category.catalog",
      (db) => queryCatalog(db, filters, { categorySlug: slug }),
      {
        items: [],
        total: 0,
        page: 1,
        pageSize: filters.pageSize ?? 12,
        totalPages: 1,
      },
    ),
    withDb("category.providers", (db) => listProviders(db), []),
    withDb("category.categories", (db) => listCategories(db), []),
  ]);

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
          <p className="text-muted-foreground">
            {category.description ?? `Free ${category.name} courses.`}
          </p>
          <p className="text-sm text-muted-foreground">{catalog.total} courses</p>
        </div>

        <CatalogFiltersForm
          action={`/category/${slug}`}
          filters={filters}
          providers={providers}
          categories={categories}
          showCategoryLinks
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title="No matching courses"
            description="No courses match these filters yet."
            actionHref="/search"
            actionLabel="Browse all courses"
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
          basePath={`/category/${slug}`}
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
