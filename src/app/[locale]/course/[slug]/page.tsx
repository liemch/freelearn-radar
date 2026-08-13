import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CourseSection } from "@/components/public/course-section";
import { FreeStatusBadge } from "@/components/public/free-status-badge";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { LocalizedLink } from "@/components/public/localized-link";
import { ShareCourseButton } from "@/components/public/share-course-button";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { VerificationFreshnessNotice } from "@/components/public/verification-freshness";
import { JsonLd } from "@/components/seo/json-ld";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import {
  getCourseDetailBySlug,
  listRelatedCoursesFor,
} from "@/db/repositories/course-repository";
import { trackProductEvent } from "@/domain/analytics/product-events";
import {
  formatLevelLabel,
  getCertificateTypeLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";
import { formatDuration } from "@/domain/course/recommendation";
import { currentBestPath } from "@/domain/discovery/monthly-collection";
import {
  buildBreadcrumbJsonLd,
  buildCourseJsonLd,
} from "@/domain/seo/json-ld";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";

type CoursePageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({
  params,
}: CoursePageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const { slug } = await params;
  const course = await withDb(
    "course.metadata",
    (db) => getCourseDetailBySlug(db, slug),
    null,
  );

  if (!course) {
    return { title: dict.meta.courseNotFound, robots: { index: false, follow: false } };
  }

  if (course.status !== "PUBLISHED") {
    return {
      title: `${course.title} | FreeLearn Radar`,
      description:
        "This course or free offer may no longer be available on FreeLearn Radar.",
      robots: { index: false, follow: true },
    };
  }

  const description =
    course.shortDescription ?? course.description ?? undefined;
  const path = localePath(locale, `/course/${course.slug}`);

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  return {
    title: `${course.title} | FreeLearn Radar`,
    description,
    alternates: buildLocaleAlternates(
      appUrl,
      locale,
      `/course/${course.slug}`,
    ),
    openGraph: {
      title: course.title,
      description,
      url: path,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: course.title,
      description,
    },
  };
}

export default async function CourseDetailPage({ params }: CoursePageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const { slug } = await params;
  const course = await withDb(
    "course.detail",
    (db) => getCourseDetailBySlug(db, slug),
    null,
  );

  if (!course || course.status === "DRAFT" || course.status === "ARCHIVED") {
    notFound();
  }

  const related = await withDb(
    "course.related",
    (db) =>
      listRelatedCoursesFor(
        db,
        {
          id: course.id,
          providerId: course.providerId,
          level: course.level,
          language: course.language,
          priceType: course.priceType,
          categoryIds: course.categories.map((category) => category.id),
        },
        4,
      ),
    [],
  );

  trackProductEvent({
    event: "course_view",
    path: `/course/${course.slug}`,
    courseId: course.id,
    courseSlug: course.slug,
  });

  const price = getPriceTypeLabel(course.priceType, locale);
  const certificate = getCertificateTypeLabel(course.certificateType, locale);
  const duration = formatDuration(course.durationMinutes);
  const inactive =
    course.status === "EXPIRED" || course.status === "UNAVAILABLE";

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  const shareUrl = `${appUrl}${localePath(locale, `/course/${course.slug}`)}`;
  const bestHref = currentBestPath();
  const homeUrl = `${appUrl}${localePath(locale, "/")}`;
  const providerUrl = `${appUrl}${localePath(locale, `/provider/${course.provider.slug}`)}`;

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <JsonLd
        data={buildCourseJsonLd({
          course,
          providerName: course.provider.name,
          appUrl,
          courseUrl: shareUrl,
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", url: homeUrl },
          {
            name: course.provider.name,
            url: providerUrl,
          },
          { name: course.title, url: shareUrl },
        ])}
      />
      <SiteHeader locale={locale} />
      <PageShell>
        <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
          <article className="space-y-8">
            <header className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                <LocalizedLink
                  href={`/provider/${course.provider.slug}`}
                  className="hover:text-primary hover:underline"
                >
                  {course.provider.name}
                </LocalizedLink>
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {course.title}
              </h1>
              <p className="max-w-2xl text-muted-foreground text-pretty">
                {course.shortDescription ?? dict.courseDetail.fallbackSummary}
              </p>

              {inactive ? (
                <p
                  className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-950"
                  role="status"
                >
                  {dict.courseDetail.inactiveNotice}
                </p>
              ) : (
                <VerificationFreshnessNotice
                  lastVerifiedAt={course.lastVerifiedAt}
                  priceType={course.priceType}
                  locale={locale}
                />
              )}

              <div
                className="flex flex-wrap items-center gap-2"
                aria-label={dict.a11y.freeStatusAndCertificate}
              >
                <FreeStatusBadge priceType={course.priceType} locale={locale} size="lg" />
                <span className="rounded-full border border-border bg-secondary px-3 py-1 text-sm">
                  {certificate}
                </span>
              </div>
            </header>

            <section aria-labelledby="facts-heading" className="space-y-3">
              <h2 id="facts-heading" className="text-lg font-semibold">
                {dict.courseDetail.keyFacts}
              </h2>
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <Fact
                  label={dict.courseDetail.whatIsFree}
                  value={price.label}
                  hint={price.shortHint}
                />
                <Fact label={dict.courseDetail.certificate} value={certificate} />
                <Fact
                  label={dict.courseDetail.level}
                  value={formatLevelLabel(course.level, locale)}
                />
                <Fact
                  label={dict.courseDetail.duration}
                  value={duration ?? dict.courseDetail.unknown}
                />
                <Fact
                  label={dict.courseDetail.language}
                  value={course.language ?? dict.courseDetail.unknown}
                />
                <Fact
                  label={dict.courseDetail.instructor}
                  value={course.instructor ?? dict.courseDetail.notListed}
                />
                <Fact
                  label={dict.courseDetail.lastVerified}
                  value={
                    course.lastVerifiedAt
                      ? course.lastVerifiedAt.toLocaleDateString(locale)
                      : dict.courseDetail.notVerified
                  }
                />
                <Fact
                  label={dict.courseDetail.provider}
                  value={course.provider.name}
                />
              </dl>
            </section>

            <section className="space-y-2" aria-labelledby="why-heading">
              <h2 id="why-heading" className="text-lg font-semibold">
                {dict.courseDetail.whyLearn}
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {course.description || dict.courseDetail.noSummary}
              </p>
            </section>

            <nav
              className="flex flex-wrap gap-2"
              aria-label={dict.a11y.exploreRelated}
            >
              {course.categories.map((category) => (
                <LocalizedLink
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {category.name}
                </LocalizedLink>
              ))}
              <LocalizedLink
                href={`/provider/${course.provider.slug}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent"
              >
                {dict.courseDetail.moreFrom(course.provider.name)}
              </LocalizedLink>
              <LocalizedLink
                href={bestHref}
                className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent"
              >
                {dict.courseDetail.monthlyBest}
              </LocalizedLink>
            </nav>

            <CourseSection
              locale={locale}
              title={
                inactive
                  ? dict.courseDetail.relatedAlternatives
                  : dict.courseDetail.relatedCourses
              }
              courses={related}
            />
          </article>

          <aside className="h-fit space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-lg font-semibold">
              {dict.courseDetail.viewCourseHeading}
            </h2>
            <p className="text-sm text-muted-foreground">
              {dict.courseDetail.continuesOn(course.provider.name)}
            </p>
            <Button
              asChild
              className="w-full"
              size="lg"
              variant={inactive ? "outline" : "default"}
            >
              <a href={`/course/${course.slug}/go`}>
                {dict.courseDetail.viewCourseOn(course.provider.name)}
              </a>
            </Button>
            <ShareCourseButton
              title={course.title}
              url={shareUrl}
              shareLabel={dict.share.action}
              copiedLabel={dict.share.copied}
            />
            <p className="sr-only">Source URL: {course.canonicalUrl}</p>
          </aside>
        </div>
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border-b border-border/70 pb-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium" title={hint}>
        {value}
      </dd>
    </div>
  );
}
