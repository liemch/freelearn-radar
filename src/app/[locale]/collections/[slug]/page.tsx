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
import { listCategories } from "@/db/repositories/category-repository";
import { queryCatalog } from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { trackProductEvent } from "@/domain/analytics/product-events";
import {
  buildCatalogQuery,
  catalogFiltersToQuery,
  DURATION_BUCKETS,
  durationBucketFromSlug,
  durationBucketLabel,
} from "@/domain/course/catalog-query";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";

type CollectionPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return Object.values(DURATION_BUCKETS).map((bucket) => ({
    slug: bucket.slug,
  }));
}

export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const { slug } = await params;
  const bucketKey = durationBucketFromSlug(slug);
  if (!bucketKey) {
    return { title: dict.meta.collectionNotFound, robots: { index: false } };
  }
  const bucket = DURATION_BUCKETS[bucketKey];
  const bucketLabel = durationBucketLabel(bucket, locale);

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  return {
    title: `${bucketLabel} Free Courses | FreeLearn Radar`,
    description: `Deterministic collection of free courses lasting up to ${bucket.maxMinutes} minutes.`,
    alternates: buildLocaleAlternates(
      appUrl,
      locale,
      `/collections/${bucket.slug}`,
    ),
  };
}

export default async function DurationCollectionPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const { slug } = await params;
  const bucketKey = durationBucketFromSlug(slug);
  if (!bucketKey) notFound();
  const bucket = DURATION_BUCKETS[bucketKey];
  const bucketLabel = durationBucketLabel(bucket, locale);

  const raw = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") urlParams.set(key, value);
  }
  const filters = buildCatalogQuery(urlParams);
  filters.durationMaxMinutes = bucket.maxMinutes;
  if (!filters.sort) filters.sort = "shortest";

  const [catalog, providers, categories] = await Promise.all([
    withDb(
      "collection.catalog",
      (db) => queryCatalog(db, filters),
      {
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
        totalPages: 1,
      },
    ),
    withDb("collection.providers", (db) => listProviders(db), []),
    withDb("collection.categories", (db) => listCategories(db), []),
  ]);

  trackProductEvent({
    event: "collection_view",
    path: `/collections/${bucket.slug}`,
    resultCount: catalog.total,
  });

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <LocalizedLink href="/" className="hover:underline">
              {dict.common.home}
            </LocalizedLink>{" "}
            / {dict.common.collections} / {bucketLabel}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {bucketLabel}
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            {dict.pages.collectionIntro(bucket.maxMinutes)}
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            {Object.values(DURATION_BUCKETS).map((item) => (
              <LocalizedLink
                key={item.slug}
                href={`/collections/${item.slug}`}
                className={
                  item.slug === bucket.slug
                    ? "rounded-full bg-primary px-3 py-1 text-primary-foreground"
                    : "rounded-full border border-border px-3 py-1 hover:bg-accent"
                }
              >
                {durationBucketLabel(item, locale)}
              </LocalizedLink>
            ))}
          </div>
        </div>

        <CatalogFiltersForm
          action={`/collections/${bucket.slug}`}
          filters={filters}
          providers={providers}
          categories={categories}
          showCategoryLinks
          labels={dict.filters}
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title={dict.pages.collectionEmptyTitle}
            description={dict.pages.collectionEmptyDescription}
            actionHref={localePath(locale, "/search")}
            actionLabel={dict.common.searchCatalog}
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
          basePath={localePath(locale, `/collections/${bucket.slug}`)}
          query={catalogFiltersToQuery({
            ...filters,
            durationMaxMinutes: undefined,
          })}
          labels={dict.pagination}
        />
      </div>
      <SiteFooter locale={locale} />
    </main>
  );
}
