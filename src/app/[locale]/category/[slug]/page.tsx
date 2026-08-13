import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogFiltersForm } from "@/components/public/catalog-filters";
import { CourseCard } from "@/components/public/course-card";
import { EmptyState } from "@/components/public/empty-state";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { LocalizedLink } from "@/components/public/localized-link";
import { Pagination } from "@/components/public/pagination";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PageShell } from "@/components/layout/page-shell";
import { findCategoryBySlug, listCategories } from "@/db/repositories/category-repository";
import { queryCatalog } from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { trackProductEvent } from "@/domain/analytics/product-events";
import {
  buildCatalogQuery,
  catalogFiltersToQuery,
} from "@/domain/course/catalog-query";
import { withDb } from "@/lib/db-safe";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";

type CategoryPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: CategoryPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const { slug } = await params;
  const raw = await searchParams;
  const hasFilters = Object.keys(raw).some(
    (key) => key !== "page" && raw[key],
  );
  const category = await withDb(
    "category.metadata",
    (db) => findCategoryBySlug(db, slug),
    null,
  );
  const path = category
    ? localePath(locale, `/category/${category.slug}`)
    : undefined;

  return {
    title: category
      ? `${category.name} Free Courses | FreeLearn Radar`
      : "Category not found",
    description: category?.description ?? undefined,
    alternates: category ? { canonical: path } : undefined,
    robots: hasFilters
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: category
      ? {
          title: `${category.name} free courses`,
          description: category.description ?? undefined,
          url: path,
          type: "website",
        }
      : undefined,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
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

  trackProductEvent({
    event: "category_view",
    path: `/category/${slug}`,
    categorySlug: slug,
    resultCount: catalog.total,
  });

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <PageShell className="space-y-8 py-10">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {category.name}
          </h1>
          <p className="text-muted-foreground">
            {category.description ?? `Free ${category.name} courses.`}
          </p>
          <p className="text-sm text-muted-foreground">{catalog.total} courses</p>
          <p className="text-sm">
            <LocalizedLink
              href={`/free-courses/${slug === "data-science" ? "data-science" : slug}`}
              className="text-primary hover:underline"
            >
              Topic guide
            </LocalizedLink>
            {" · "}
            <LocalizedLink
              href="/free-certificate-courses"
              className="text-primary hover:underline"
            >
              Free certificates
            </LocalizedLink>
          </p>
        </div>

        <CatalogFiltersForm
          action={`/category/${slug}`}
          filters={filters}
          providers={providers}
          categories={categories}
          showCategoryLinks
          labels={dict.filters}
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title="No matching courses"
            description="No courses match these filters yet. Try clearing filters or browse another category."
            actionHref={localePath(locale, "/search")}
            actionLabel="Browse all courses"
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
          basePath={localePath(locale, `/category/${slug}`)}
          query={catalogFiltersToQuery(filters)}
        />
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
