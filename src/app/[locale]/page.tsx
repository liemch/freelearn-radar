import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseSection } from "@/components/public/course-section";
import { EmptyState } from "@/components/public/empty-state";
import { HomeHero } from "@/components/public/home-hero";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { TrustStrip } from "@/components/public/trust-strip";
import { PageShell, PageStack } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { listCategories } from "@/db/repositories/category-repository";
import {
  getCatalogTrustSignals,
  listPublishedCoursesWithProvider,
  queryCatalog,
} from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import { currentBestPath } from "@/domain/discovery/monthly-collection";
import { rankCourses } from "@/domain/ranking/ranking";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { localePath } from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "en";
  const dict = getDictionary(locale);
  const path = localePath(locale, "/");

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    /* optional in build */
  }

  const title =
    locale === "vi"
      ? "FreeLearn Radar — Khóa học miễn phí đáng học"
      : "FreeLearn Radar — Free online courses worth your time";

  return {
    title,
    description: dict.hero.subhead,
    alternates: buildLocaleAlternates(appUrl, locale, "/"),
    openGraph: {
      title: "FreeLearn Radar",
      description: dict.hero.subhead,
      url: path,
      type: "website",
    },
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) {
    notFound();
  }
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const bestHref = localePath(locale, currentBestPath());

  const topics = [
    { href: localePath(locale, "/free-courses/python"), label: "Python" },
    { href: localePath(locale, "/free-courses/ai"), label: "AI" },
    {
      href: localePath(locale, "/free-certificate-courses"),
      label: locale === "vi" ? "Chứng chỉ miễn phí" : "Free certificates",
    },
    {
      href: localePath(locale, "/free-courses/data-science"),
      label: locale === "vi" ? "Data Science" : "Data Science",
    },
    {
      href: localePath(locale, "/free-courses/project-management"),
      label: locale === "vi" ? "Quản lý dự án" : "Project Management",
    },
  ];

  const [published, categories, providers, freeCert, shortCourses, trust] =
    await Promise.all([
      withDb(
        "home.published",
        (db) => listPublishedCoursesWithProvider(db, 60),
        [],
      ),
      withDb("home.categories", (db) => listCategories(db), []),
      withDb("home.providers", (db) => listProviders(db), []),
      withDb(
        "home.freeCert",
        (db) =>
          queryCatalog(db, {
            certificateType: "FREE_CERTIFICATE",
            sort: "recommended",
            page: 1,
            pageSize: 6,
          }),
        { items: [], total: 0, page: 1, pageSize: 6, totalPages: 1 },
      ),
      withDb(
        "home.short",
        (db) =>
          queryCatalog(db, {
            durationMaxMinutes: 60,
            sort: "shortest",
            page: 1,
            pageSize: 6,
          }),
        { items: [], total: 0, page: 1, pageSize: 6, totalPages: 1 },
      ),
      withDb("home.trust", (db) => getCatalogTrustSignals(db), {
        publishedCount: 0,
        lastVerifiedAt: null,
      }),
    ]);

  const freeEligible = published.filter((course) =>
    isEligibleForFreeLists(course.priceType),
  );
  const ranked = rankCourses(freeEligible);
  const best = ranked.slice(0, 6);
  const freeThisWeek = ranked
    .filter(
      (course) =>
        course.priceType === "TEMPORARILY_FREE" ||
        course.priceType === "FREE_WITH_COUPON" ||
        course.priceType === "FREE_FULL",
    )
    .slice(0, 6);
  const recentlyVerified = [...freeEligible]
    .filter((course) => course.lastVerifiedAt)
    .sort(
      (a, b) =>
        (b.lastVerifiedAt?.getTime() ?? 0) - (a.lastVerifiedAt?.getTime() ?? 0),
    )
    .slice(0, 6);

  const hasCourses = published.length > 0;

  return (
    <main className="flex min-h-screen flex-col">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <HomeHero hero={dict.hero} topics={topics} />
      <TrustStrip
        locale={locale}
        publishedCount={trust.publishedCount}
        providerCount={providers.length}
        lastVerifiedAt={trust.lastVerifiedAt}
      />

      <PageShell>
        <PageStack className="gap-8 sm:gap-10">
          {!hasCourses ? (
            <EmptyState
              title={dict.empty.catalogTitle}
              description={dict.empty.catalogDescription}
              actionHref={
                categories[0]
                  ? localePath(locale, `/category/${categories[0].slug}`)
                  : localePath(locale, "/search")
              }
              actionLabel={dict.empty.catalogAction}
            />
          ) : null}

          {freeThisWeek.length > 0 ? (
            <CourseSection
              locale={locale}
              title={dict.sections.freeThisWeek}
              subtitle={dict.sections.freeThisWeekSub}
              courses={freeThisWeek}
              viewAllHref={localePath(locale, "/search?price=TEMPORARILY_FREE")}
              viewAllLabel={dict.sections.viewAll}
              priorityCount={4}
            />
          ) : null}

          {best.length > 0 ? (
            <CourseSection
              locale={locale}
              title={dict.sections.bestFree}
              subtitle={dict.sections.bestFreeSub}
              courses={best}
              viewAllHref={localePath(locale, "/search?sort=recommended")}
              viewAllLabel={dict.sections.viewAll}
              priorityCount={freeThisWeek.length === 0 ? 4 : 0}
            />
          ) : null}

          {recentlyVerified.length > 0 ? (
            <CourseSection
              locale={locale}
              title={dict.sections.recentlyVerified}
              subtitle={dict.sections.recentlyVerifiedSub}
              courses={recentlyVerified}
              viewAllHref={localePath(locale, "/search?sort=newest")}
              viewAllLabel={dict.sections.viewAll}
            />
          ) : null}

          {categories.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {dict.sections.browseTopic}
              </h2>
              {/*
                Tiles rather than a scrolling pill rail: topics are a primary
                entry point, and a horizontal scroller hides most of them on the
                exact screens where browsing matters most. No counts — deriving
                an accurate per-category total would cost one query each.
              */}
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={localePath(locale, `/category/${category.slug}`)}
                      className="flex h-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium transition hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full bg-primary/60"
                      />
                      <span className="min-w-0 truncate">{category.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {freeCert.items.length > 0 ? (
            <CourseSection
              locale={locale}
              title={dict.sections.freeCertificates}
              subtitle={dict.sections.freeCertificatesSub}
              courses={freeCert.items}
              viewAllHref={localePath(locale, "/free-certificate-courses")}
              viewAllLabel={dict.sections.viewAll}
            />
          ) : null}

          {shortCourses.items.length > 0 ? (
            <CourseSection
              locale={locale}
              title={dict.sections.shortCourses}
              subtitle={dict.sections.shortCoursesSub}
              courses={shortCourses.items}
              viewAllHref={localePath(locale, "/collections/under-1-hour")}
              viewAllLabel={dict.sections.viewAll}
            />
          ) : null}

          {providers.length > 0 ? (
            <section className="space-y-3 border-t border-border/50 pt-8">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {dict.sections.providers}
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {providers.slice(0, 8).map((provider) => (
                  <Link
                    key={provider.id}
                    href={localePath(locale, `/provider/${provider.slug}`)}
                    className="text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    {provider.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/*
            Hidden on an empty catalogue: the monthly collection would render as
            a heading with nothing beneath it, directly under the empty state
            that already explains the situation.
          */}
          {hasCourses ? (
            <section className="border-t border-border/50 pt-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    {dict.sections.monthlyCollection}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dict.sections.monthlyCollectionSub}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={bestHref}>
                    {dict.sections.monthlyCollectionCta}
                  </Link>
                </Button>
              </div>
            </section>
          ) : null}
        </PageStack>
      </PageShell>

      <SiteFooter locale={locale} />
    </main>
  );
}
