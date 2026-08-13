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
import { PageShell } from "@/components/layout/page-shell";
import { listCategories } from "@/db/repositories/category-repository";
import {
  countPublishedByProviderSlug,
  queryCatalog,
} from "@/db/repositories/course-repository";
import {
  findProviderBySlug,
  listProviders,
} from "@/db/repositories/provider-repository";
import { trackProductEvent } from "@/domain/analytics/product-events";
import {
  buildCatalogQuery,
  catalogFiltersToQuery,
} from "@/domain/course/catalog-query";
import { buildProviderJsonLd } from "@/domain/seo/json-ld";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";

type ProviderPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: ProviderPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const { slug } = await params;
  const provider = await withDb(
    "provider.meta",
    (db) => findProviderBySlug(db, slug),
    null,
  );
  if (!provider) {
    return { title: dict.meta.providerNotFound, robots: { index: false } };
  }

  const path = localePath(locale, `/provider/${provider.slug}`);

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  return {
    title: `Free ${provider.name} Courses | FreeLearn Radar`,
    description: `Browse curated free courses from ${provider.name} (${provider.domain}) with clear free-status labels.`,
    alternates: buildLocaleAlternates(appUrl, locale, `/provider/${provider.slug}`),
    openGraph: {
      title: `Free ${provider.name} courses`,
      description: `Free courses from ${provider.name} on FreeLearn Radar.`,
      url: path,
      type: "website",
    },
  };
}

export default async function ProviderPage({
  params,
  searchParams,
}: ProviderPageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const { slug } = await params;
  const provider = await withDb(
    "provider.find",
    (db) => findProviderBySlug(db, slug),
    null,
  );
  if (!provider || !provider.active) notFound();

  const raw = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") urlParams.set(key, value);
  }
  urlParams.set("provider", provider.slug);
  const filters = buildCatalogQuery(urlParams);
  filters.providerSlug = provider.slug;

  const [catalog, providers, categories, total] = await Promise.all([
    withDb(
      "provider.catalog",
      (db) => queryCatalog(db, filters),
      {
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
        totalPages: 1,
      },
    ),
    withDb("provider.providers", (db) => listProviders(db), []),
    withDb("provider.categories", (db) => listCategories(db), []),
    withDb(
      "provider.count",
      (db) => countPublishedByProviderSlug(db, provider.slug),
      0,
    ),
  ]);

  trackProductEvent({
    event: "provider_view",
    path: `/provider/${provider.slug}`,
    providerSlug: provider.slug,
    resultCount: catalog.total,
  });

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  const recentlyVerified = catalog.items
    .filter((course) => course.lastVerifiedAt)
    .slice(0, 6);

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <JsonLd
        data={buildProviderJsonLd({ provider, appUrl })}
      />
      <SiteHeader locale={locale} />
      <PageShell className="space-y-6 py-7 sm:space-y-8 sm:py-10">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <LocalizedLink href="/" className="hover:underline">
              {dict.common.home}
            </LocalizedLink>{" "}
            / {dict.common.providers} / {provider.name}
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight sm:text-4xl">
            {dict.pages.providerHeading(provider.name)}
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            {dict.pages.providerIntro}{" "}
            <span className="font-medium text-foreground">{provider.domain}</span>
            . {dict.pages.providerNotHosted}
          </p>
          <p className="text-sm text-muted-foreground">
            {dict.pages.providerListed(total)}
          </p>
        </div>

        <CatalogFiltersForm
          action={`/provider/${provider.slug}`}
          filters={filters}
          providers={providers}
          categories={categories}
          showCategoryLinks
          labels={dict.filters}
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title={dict.pages.providerEmptyTitle(provider.name)}
            description={dict.pages.providerEmptyDescription}
            actionHref={localePath(locale, "/search")}
            actionLabel={dict.common.searchCatalog}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {catalog.items.map((course) => (
              <CourseCard key={course.id} course={course} locale={locale} />
            ))}
          </div>
        )}

        <Pagination
          page={catalog.page}
          totalPages={catalog.totalPages}
          basePath={localePath(locale, `/provider/${provider.slug}`)}
          query={catalogFiltersToQuery({ ...filters, providerSlug: undefined })}
          labels={dict.pagination}
        />

        {recentlyVerified.length > 0 ? (
          <section className="space-y-3 border-t border-border pt-8">
            <h2 className="text-lg font-semibold">
              {dict.pages.providerRecentlyVerified}
            </h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {recentlyVerified.map((course) => (
                <li key={course.id}>
                  <LocalizedLink
                    href={`/course/${course.slug}`}
                    className="text-foreground hover:underline"
                  >
                    {course.title}
                  </LocalizedLink>
                  {course.lastVerifiedAt
                    ? ` · ${course.lastVerifiedAt.toLocaleDateString()}`
                    : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
