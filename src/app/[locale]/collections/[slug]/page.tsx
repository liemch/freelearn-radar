import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogFiltersForm } from "@/components/public/catalog-filters";
import { CourseCard } from "@/components/public/course-card";
import { EmptyState } from "@/components/public/empty-state";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
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
} from "@/domain/course/catalog-query";
import { withDb } from "@/lib/db-safe";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";

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
  const { slug } = await params;
  const bucketKey = durationBucketFromSlug(slug);
  if (!bucketKey) {
    return { title: "Collection not found", robots: { index: false } };
  }
  const bucket = DURATION_BUCKETS[bucketKey];
  return {
    title: `${bucket.label} Free Courses | FreeLearn Radar`,
    description: `Deterministic collection of free courses lasting up to ${bucket.maxMinutes} minutes.`,
    alternates: { canonical: localePath(locale, `/collections/${bucket.slug}`) },
  };
}

export default async function DurationCollectionPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const locale = await resolveLocaleParam(params);
  const { slug } = await params;
  const bucketKey = durationBucketFromSlug(slug);
  if (!bucketKey) notFound();
  const bucket = DURATION_BUCKETS[bucketKey];

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
            <Link href={localePath(locale, "/")} className="hover:underline">
              Home
            </Link>{" "}
            / Collections / {bucket.label}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {bucket.label}
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            Courses with a known duration of {bucket.maxMinutes} minutes or
            less. Courses without duration data are excluded.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            {Object.values(DURATION_BUCKETS).map((item) => (
              <Link
                key={item.slug}
                href={localePath(locale, `/collections/${item.slug}`)}
                className={
                  item.slug === bucket.slug
                    ? "rounded-full bg-primary px-3 py-1 text-primary-foreground"
                    : "rounded-full border border-border px-3 py-1 hover:bg-accent"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <CatalogFiltersForm
          action={localePath(locale, `/collections/${bucket.slug}`)}
          filters={filters}
          providers={providers}
          categories={categories}
          showCategoryLinks
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title="No short courses match yet"
            description="Try another duration collection or browse all courses."
            actionHref={localePath(locale, "/search")}
            actionLabel="Search catalog"
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
        />
      </div>
      <SiteFooter locale={locale} />
    </main>
  );
}
