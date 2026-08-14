import type { Metadata } from "next";

import { CatalogFiltersForm } from "@/components/public/catalog-filters";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { CourseGrid } from "@/components/public/course-grid";
import { EmptyState } from "@/components/public/empty-state";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { Pagination } from "@/components/public/pagination";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import { PageShell } from "@/components/layout/page-shell";
import { listCategories } from "@/db/repositories/category-repository";
import { queryCatalog } from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { trackProductEvent } from "@/domain/analytics/product-events";
import {
  buildCatalogQuery,
  catalogFiltersToQuery,
} from "@/domain/course/catalog-query";
import { buildItemListJsonLd } from "@/domain/seo/json-ld";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const path = localePath(locale, "/free-certificate-courses");

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  return {
    title: "Free Certificate Courses | FreeLearn Radar",
    description:
      "Browse courses with a free certificate — not paid-only or unknown certificate status. Confirm free status on the provider before enrolling.",
    alternates: buildLocaleAlternates(appUrl, locale, "/free-certificate-courses"),
    openGraph: {
      title: dict.meta.certificatesTitle,
      description: "Courses with free certificate status on FreeLearn Radar.",
      url: path,
      type: "website",
    },
  };
}

export default async function FreeCertificateCoursesPage({
  params,
  searchParams,
}: PageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const raw = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") urlParams.set(key, value);
  }
  const filters = buildCatalogQuery(urlParams);
  filters.certificateType = "FREE_CERTIFICATE";

  const [catalog, providers, categories] = await Promise.all([
    withDb(
      "freeCert.catalog",
      (db) => queryCatalog(db, filters),
      {
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
        totalPages: 1,
      },
    ),
    withDb("freeCert.providers", (db) => listProviders(db), []),
    withDb("freeCert.categories", (db) => listCategories(db), []),
  ]);

  trackProductEvent({
    event: "collection_view",
    path: "/free-certificate-courses",
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
          name: dict.pages.certificatesHeading,
          description: dict.pages.certificatesIntro,
          url: `${appUrl}/free-certificate-courses`,
          courses: catalog.items,
          appUrl,
        })}
      />
      <SiteHeader locale={locale} />
      <PageShell className="space-y-6 py-7 sm:space-y-8 sm:py-10">
        <div className="space-y-3">
          <Breadcrumb
            label={dict.a11y.breadcrumb}
            items={[
              { label: dict.common.home, href: "/" },
              { label: dict.pages.certificatesHeading },
            ]}
          />
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight sm:text-3xl">
            {dict.pages.certificatesHeading}
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            {dict.pages.certificatesIntro}
          </p>
          <p className="text-sm text-muted-foreground">
            {dict.common.courseCount(catalog.total)}
          </p>
        </div>

        <CatalogFiltersForm
          action="/free-certificate-courses"
          filters={filters}
          providers={providers}
          categories={categories}
          showCategoryLinks
          labels={dict.filters}
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title={dict.pages.certificatesEmptyTitle}
            description={dict.pages.certificatesEmptyDescription}
            actionHref={localePath(locale, "/search")}
            actionLabel={dict.common.browseAll}
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
          basePath={localePath(locale, "/free-certificate-courses")}
          query={catalogFiltersToQuery({
            ...filters,
            certificateType: undefined,
          })}
          labels={dict.pagination}
        />
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
