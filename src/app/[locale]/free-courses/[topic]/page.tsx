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
import { JsonLd } from "@/components/seo/json-ld";
import { findCategoryBySlug, listCategories } from "@/db/repositories/category-repository";
import { queryCatalog } from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { trackProductEvent } from "@/domain/analytics/product-events";
import {
  buildCatalogQuery,
  catalogFiltersToQuery,
} from "@/domain/course/catalog-query";
import {
  findTopicLanding,
  listTopicSlugs,
  topicCopy,
} from "@/domain/discovery/topic-landings";
import { buildItemListJsonLd } from "@/domain/seo/json-ld";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";

type TopicPageProps = {
  params: Promise<{ locale: string; topic: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return listTopicSlugs().map((topic) => ({ topic }));
}

export async function generateMetadata({
  params,
}: TopicPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const { topic } = await params;
  const landing = findTopicLanding(topic);
  if (!landing) {
    return { title: dict.meta.topicNotFound, robots: { index: false } };
  }

  const copy = topicCopy(landing, locale);
  const path = localePath(locale, `/free-courses/${landing.slug}`);

  return {
    title: `${copy.title} | FreeLearn Radar`,
    description: copy.description,
    alternates: { canonical: path },
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: path,
      type: "website",
    },
  };
}

export default async function FreeCoursesTopicPage({
  params,
  searchParams,
}: TopicPageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const { topic } = await params;
  const landing = findTopicLanding(topic);
  if (!landing) notFound();

  const copy = topicCopy(landing, locale);

  const raw = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") urlParams.set(key, value);
  }
  const filters = buildCatalogQuery(urlParams);

  const category = await withDb(
    "topic.category",
    (db) => findCategoryBySlug(db, landing.categorySlug),
    null,
  );
  if (!category) notFound();

  const [catalog, providers, categories] = await Promise.all([
    withDb(
      "topic.catalog",
      (db) =>
        queryCatalog(db, filters, { categorySlug: landing.categorySlug }),
      {
        items: [],
        total: 0,
        page: 1,
        pageSize: filters.pageSize ?? 12,
        totalPages: 1,
      },
    ),
    withDb("topic.providers", (db) => listProviders(db), []),
    withDb("topic.categories", (db) => listCategories(db), []),
  ]);

  // Thin-page guard: no published courses for this topic → 404
  if (catalog.total === 0 && !filters.q && !filters.level && !filters.priceType) {
    notFound();
  }

  trackProductEvent({
    event: "topic_view",
    path: `/free-courses/${landing.slug}`,
    categorySlug: landing.categorySlug,
    resultCount: catalog.total,
  });

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <JsonLd
        data={buildItemListJsonLd({
          name: copy.heading,
          description: copy.description,
          url: `${appUrl}/free-courses/${landing.slug}`,
          courses: catalog.items,
          appUrl,
        })}
      />
      <SiteHeader locale={locale} />
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <LocalizedLink href="/" className="hover:underline">
              {dict.common.home}
            </LocalizedLink>{" "}
            / {dict.common.freeCourses} / {landing.slug}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {copy.heading}
          </h1>
          <p className="max-w-3xl text-muted-foreground">{copy.description}</p>
          <p className="text-sm text-muted-foreground">
            {dict.common.courseCount(catalog.total)}
          </p>
        </div>

        <CatalogFiltersForm
          action={`/free-courses/${landing.slug}`}
          filters={filters}
          providers={providers}
          categories={categories}
          labels={dict.filters}
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title={dict.pages.topicEmptyTitle}
            description={dict.pages.topicEmptyDescription}
            actionHref={localePath(locale, `/category/${landing.categorySlug}`)}
            actionLabel={dict.common.openCategory}
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
          basePath={localePath(locale, `/free-courses/${landing.slug}`)}
          query={catalogFiltersToQuery(filters)}
          labels={dict.pagination}
        />

        <section className="space-y-3 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">{dict.common.relatedTopics}</h2>
          <div className="flex flex-wrap gap-2">
            {landing.relatedTopics.map((related) => (
              <LocalizedLink
                key={related}
                href={`/free-courses/${related}`}
                className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent capitalize"
              >
                {related.replace(/-/g, " ")}
              </LocalizedLink>
            ))}
            <LocalizedLink
              href={`/category/${landing.categorySlug}`}
              className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent"
            >
              {dict.pages.topicFullCategory(category.name)}
            </LocalizedLink>
          </div>
        </section>
      </div>
      <SiteFooter locale={locale} />
    </main>
  );
}
