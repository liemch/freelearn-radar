import type { Metadata } from "next";

import { CatalogFiltersForm } from "@/components/public/catalog-filters";
import { CourseCard } from "@/components/public/course-card";
import { EmptyState } from "@/components/public/empty-state";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { Pagination } from "@/components/public/pagination";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PageShell } from "@/components/layout/page-shell";
import { listCategories } from "@/db/repositories/category-repository";
import { queryCatalog } from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { trackProductEvent } from "@/domain/analytics/product-events";
import {
  buildCatalogQuery,
  catalogFiltersToQuery,
} from "@/domain/course/catalog-query";
import { withDb } from "@/lib/db-safe";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const raw = await searchParams;
  const hasFilters = Object.keys(raw).some(
    (key) => key !== "page" && raw[key],
  );
  const path = localePath(locale, "/search");

  return {
    title: "Search Free Courses | FreeLearn Radar",
    description:
      "Search curated free online courses by keyword, provider, level, free type, and certificate.",
    alternates: { canonical: path },
    // Filtered search URLs are shareable but should not explode the index.
    robots: hasFilters
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title: "Search Free Courses",
      description: "Find curated free courses on FreeLearn Radar.",
      url: path,
      type: "website",
    },
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: SearchPageProps) {
  const locale = await resolveLocaleParam(params);
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

  trackProductEvent({
    event: "search",
    path: "/search",
    query: filters.q,
    resultCount: catalog.total,
  });

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <PageShell className="space-y-8 py-10">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Search courses
          </h1>
          <p className="text-muted-foreground">
            Filter by provider, level, free type, certificate, and duration.
          </p>
          <p className="text-sm text-muted-foreground">
            {catalog.total} result{catalog.total === 1 ? "" : "s"}
            {filters.q ? ` for “${filters.q}”` : ""}
          </p>
        </div>

        <CatalogFiltersForm
          action={localePath(locale, "/search")}
          filters={filters}
          providers={providers}
          categories={categories}
          showCategoryLinks
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title="No courses found"
            description="Try a broader keyword, clear filters, or browse topics."
            actionHref={localePath(locale, "/free-courses/ai")}
            actionLabel="Browse AI topics"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.items.map((course) => (
              <CourseCard key={course.id} course={course} locale={locale} />
            ))}
          </div>
        )}

        <Pagination
          page={catalog.page}
          totalPages={catalog.totalPages}
          basePath={localePath(locale, "/search")}
          query={catalogFiltersToQuery(filters)}
        />
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
