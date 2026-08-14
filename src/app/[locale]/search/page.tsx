import type { Metadata } from "next";

import { CatalogFiltersForm } from "@/components/public/catalog-filters";
import { CourseGrid } from "@/components/public/course-grid";
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
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const raw = await searchParams;
  const hasFilters = Object.keys(raw).some(
    (key) => key !== "page" && raw[key],
  );

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  return {
    title:
      locale === "vi"
        ? "Tìm khóa học miễn phí | FreeLearn Radar"
        : "Search Free Courses | FreeLearn Radar",
    description: dict.search.description,
    alternates: buildLocaleAlternates(appUrl, locale, "/search"),
    robots: hasFilters
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title: dict.search.title,
      description: dict.search.description,
      url: localePath(locale, "/search"),
      type: "website",
    },
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: SearchPageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
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

  const hasNarrowingFilters = Boolean(
    filters.q ||
      filters.providerSlug ||
      filters.level ||
      filters.priceType ||
      filters.certificateType ||
      filters.durationMaxMinutes,
  );

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <PageShell className="space-y-6 py-7 sm:space-y-8 sm:py-10">
        <div className="space-y-2">
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight sm:text-3xl">
            {dict.search.title}
          </h1>
          <p className="text-[0.9375rem] text-muted-foreground sm:text-base">
            {dict.search.description}
          </p>
          <p className="text-sm text-muted-foreground">
            {dict.search.results(catalog.total, filters.q)}
          </p>
        </div>

        <CatalogFiltersForm
          action="/search"
          filters={filters}
          providers={providers}
          categories={categories}
          showCategoryLinks
          labels={dict.filters}
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title={dict.empty.searchTitle}
            description={dict.empty.searchDescription}
            actionHref="/free-courses/ai"
            actionLabel={dict.empty.searchAction}
            // Offered only when a filter is what emptied the page.
            secondaryHref={hasNarrowingFilters ? "/search" : undefined}
            secondaryLabel={
              hasNarrowingFilters ? dict.filters.clearAll : undefined
            }
          />
        ) : (
          <CourseGrid
            courses={catalog.items}
            locale={locale}
            priorityCount={4}
          />
        )}

        <Pagination
          page={catalog.page}
          totalPages={catalog.totalPages}
          basePath="/search"
          query={catalogFiltersToQuery(filters)}
          labels={dict.pagination}
        />
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
