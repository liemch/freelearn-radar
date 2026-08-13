import type { Metadata } from "next";
import Link from "next/link";

import { CatalogFiltersForm } from "@/components/public/catalog-filters";
import { CourseCard } from "@/components/public/course-card";
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
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const path = localePath(locale, "/free-certificate-courses");

  return {
    title: "Free Certificate Courses | FreeLearn Radar",
    description:
      "Browse courses with a free certificate — not paid-only or unknown certificate status. Confirm free status on the provider before enrolling.",
    alternates: { canonical: path },
    openGraph: {
      title: "Free Certificate Courses",
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
          name: "Free Certificate Courses",
          description: "Courses with free certificate status.",
          url: `${appUrl}/free-certificate-courses`,
          courses: catalog.items,
          appUrl,
        })}
      />
      <SiteHeader locale={locale} />
      <PageShell className="space-y-8 py-10">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <Link href={localePath(locale, "/")} className="hover:underline">
              Home
            </Link>{" "}
            / Free certificate courses
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Free certificate courses
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            Only courses with a verified free certificate label. Unknown or
            paid-certificate offers are excluded. Always confirm on the provider
            site before enrolling.
          </p>
          <p className="text-sm text-muted-foreground">{catalog.total} courses</p>
        </div>

        <CatalogFiltersForm
          action={localePath(locale, "/free-certificate-courses")}
          filters={filters}
          providers={providers}
          categories={categories}
          showCategoryLinks
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title="No free-certificate courses yet"
            description="Browse all free courses or try a topic landing page."
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
          basePath={localePath(locale, "/free-certificate-courses")}
          query={catalogFiltersToQuery({
            ...filters,
            certificateType: undefined,
          })}
        />
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
