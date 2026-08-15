import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CourseCardVisual } from "@/components/public/course-card-visual";
import { CourseSection } from "@/components/public/course-section";
import {
  AffiliateDisclosure,
  AffiliateResources,
} from "@/components/public/affiliate-resources";
import { FreeStatusBadge } from "@/components/public/free-status-badge";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { LocalizedLink } from "@/components/public/localized-link";
import { ShareCourseButton } from "@/components/public/share-course-button";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { VerificationFreshnessNotice } from "@/components/public/verification-freshness";
import { WatchCourseForm } from "@/components/public/watch-course-form";
import { JsonLd } from "@/components/seo/json-ld";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import {
  getCourseDetailBySlug,
  listRelatedCoursesFor,
  listSimilarCoursesFor,
} from "@/db/repositories/course-repository";
import { trackProductEvent } from "@/domain/analytics/product-events";
import {
  formatLevelLabel,
  getCertificateTypeLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";
import { getCourseVisual } from "@/domain/course/course-visual";
import { formatDuration } from "@/domain/course/recommendation";
import { currentBestPath } from "@/domain/discovery/monthly-collection";
import {
  buildBreadcrumbJsonLd,
  buildCourseJsonLd,
} from "@/domain/seo/json-ld";
import {
  freeDurabilityLabel,
  lastVerifiedFreshnessLabel,
  selectCourseBadgeSlots,
} from "@/domain/tracker/vocabulary";
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

  // DRAFT and ARCHIVED courses are not publicly viewable — the page below calls
  // notFound() for them — so their titles must not leak through metadata either.
  if (!course || course.status === "DRAFT" || course.status === "ARCHIVED") {
    return { title: dict.meta.courseNotFound, robots: { index: false, follow: false } };
  }

  if (course.status !== "PUBLISHED") {
    return {
      title: `${course.title} | FreeLearn Radar`,
      description: dict.meta.courseUnavailable,
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

  let similarCoursesOn = false;
  try {
    similarCoursesOn = getServerEnv().FEATURE_SIMILAR_COURSES === "true";
  } catch {
    similarCoursesOn = process.env.FEATURE_SIMILAR_COURSES === "true";
  }

  const relatedSource = {
    id: course.id,
    providerId: course.providerId,
    level: course.level,
    language: course.language,
    priceType: course.priceType,
    categoryIds: course.categories.map((category) => category.id),
  };

  const related = await withDb(
    "course.related",
    (db) =>
      similarCoursesOn
        ? listSimilarCoursesFor(db, relatedSource, 6)
        : listRelatedCoursesFor(db, relatedSource, 4),
    [],
  );

  const primaryCategorySlug = course.categories[0]?.slug ?? null;
  const affiliateCards = await withDb(
    "course.affiliate",
    async (db) => {
      const { resolveAffiliatePlacements, PLACEMENT_KEYS } = await import(
        "@/domain/affiliate/resolve-placements"
      );
      return resolveAffiliatePlacements(db, {
        placementKey: PLACEMENT_KEYS.COURSE_DETAIL_RELATED_LEARNING,
        locale,
        categorySlug: primaryCategorySlug,
        topicSlug: primaryCategorySlug,
        courseId: course.id,
        courseSlug: course.slug,
        limit: 3,
      });
    },
    [],
  );

  const courseAffiliateOn =
    process.env.FEATURE_MONETIZATION === "true" &&
    process.env.FEATURE_COURSE_AFFILIATE === "true";
  let disclosureNearCta: string | null = null;
  try {
    const env = getServerEnv();
    if (
      env.FEATURE_MONETIZATION === "true" &&
      env.FEATURE_COURSE_AFFILIATE === "true"
    ) {
      const { disclosureLabel } = await import(
        "@/domain/affiliate/affiliate-link-service"
      );
      disclosureNearCta = disclosureLabel(locale);
    }
  } catch {
    if (courseAffiliateOn) {
      disclosureNearCta =
        locale === "vi" ? "Liên kết tiếp thị" : "Affiliate link";
    }
  }

  trackProductEvent({
    event: "course_view",
    path: `/course/${course.slug}`,
    courseId: course.id,
    courseSlug: course.slug,
  });

  const visual = getCourseVisual(course);
  const price = getPriceTypeLabel(course.priceType, locale);
  const certificate = getCertificateTypeLabel(course.certificateType, locale);
  const duration = formatDuration(course.durationMinutes);
  const inactive =
    course.status === "EXPIRED" || course.status === "UNAVAILABLE";

  let trackerUi = false;
  let priceAlerts = false;
  let appUrl = "http://localhost:3000";
  try {
    const env = getServerEnv();
    appUrl = env.APP_URL;
    trackerUi = env.FEATURE_TRACKER_UI === "true";
    priceAlerts = env.FEATURE_PRICE_ALERTS === "true";
  } catch {
    appUrl = process.env.APP_URL || appUrl;
    trackerUi = process.env.FEATURE_TRACKER_UI === "true";
    priceAlerts = process.env.FEATURE_PRICE_ALERTS === "true";
  }

  const badgeSlots = selectCourseBadgeSlots({
    certificateKnown: course.certificateType !== "UNKNOWN",
    freeDurability: course.freeDurability ?? "UNKNOWN",
  });
  const durability = freeDurabilityLabel(
    course.freeDurability ?? "UNKNOWN",
    locale,
  );

  const shareUrl = `${appUrl}${localePath(locale, `/course/${course.slug}`)}`;
  const bestHref = currentBestPath();
  const homeUrl = `${appUrl}${localePath(locale, "/")}`;
  const providerUrl = `${appUrl}${localePath(locale, `/provider/${course.provider.slug}`)}`;

  const primaryCtaLabel =
    course.priceType === "FREE_FULL" || course.priceType === "FREE_AUDIT"
      ? dict.courseDetail.startFreeLearning
      : course.priceType === "FREE_WITH_COUPON" ||
          course.priceType === "TEMPORARILY_FREE"
        ? dict.courseDetail.claimFreeCourse
        : dict.courseDetail.viewCourseOn(course.provider.name);

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
        <div className="grid gap-6 py-6 sm:gap-8 sm:py-8 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)] lg:gap-10 lg:py-10">
          <div className="contents">
            <header className="order-1 space-y-3 sm:space-y-4 lg:col-start-1">
              <p className="text-sm font-medium text-muted-foreground">
                <LocalizedLink
                  href={`/provider/${course.provider.slug}`}
                  className="hover:text-primary hover:underline"
                >
                  {course.provider.name}
                </LocalizedLink>
              </p>
              <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-balance sm:text-4xl">
                {course.title}
              </h1>
              <p className="max-w-2xl text-[0.9375rem] text-muted-foreground text-pretty sm:text-base">
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
                {badgeSlots.includes("price") ? (
                  <FreeStatusBadge
                    priceType={course.priceType}
                    locale={locale}
                    size="lg"
                  />
                ) : null}
                {badgeSlots.includes("certificate") ? (
                  <span className="rounded-full border border-border bg-secondary px-3 py-1 text-sm">
                    {certificate}
                  </span>
                ) : null}
                {badgeSlots.includes("durability") ? (
                  <span className="rounded-full border border-border bg-secondary px-3 py-1 text-sm">
                    {durability}
                  </span>
                ) : null}
              </div>
            </header>

            <aside className="order-2 h-fit overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:self-start">
              {/*
                The visual sits in the action panel rather than above the h1:
                it belongs with "view this course", and putting it there keeps
                the page's first landmark the course title. No fake play button —
                only the course image from the media pipeline.
              */}
              <CourseCardVisual
                src={visual.src}
                eyebrow={visual.eyebrow}
                title={visual.title}
                toneClass={visual.toneClass}
                priority
              />
              <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
              <h2 className="text-base font-semibold sm:text-lg">
                {dict.courseDetail.viewCourseHeading}
              </h2>
              <p className="text-sm text-muted-foreground">
                {dict.courseDetail.continuesOn(course.provider.name)}
              </p>
              <Button
                asChild
                className="h-12 w-full rounded-xl text-base sm:h-11"
                size="lg"
                variant={inactive ? "outline" : "default"}
              >
                <a href={`/course/${course.slug}/go`}>
                  {primaryCtaLabel}
                </a>
              </Button>
              {disclosureNearCta ? (
                <AffiliateDisclosure label={disclosureNearCta} />
              ) : null}
              <ShareCourseButton
                title={course.title}
                url={shareUrl}
                shareLabel={dict.share.action}
                copiedLabel={dict.share.copied}
              />
              {trackerUi && priceAlerts ? (
                <div className="border-t border-border pt-3">
                  <WatchCourseForm
                    courseId={course.id}
                    locale={locale}
                    labels={{
                      heading: dict.courseDetail.watchHeading,
                      email: dict.courseDetail.watchEmail,
                      submit: dict.courseDetail.watchSubmit,
                      submitting: dict.courseDetail.watchSubmitting,
                      success: dict.courseDetail.watchSuccess,
                      error: dict.courseDetail.watchError,
                    }}
                  />
                </div>
              ) : null}
              <p className="sr-only">Source URL: {course.canonicalUrl}</p>
              </div>
            </aside>

            <div className="order-3 space-y-8 lg:col-start-1">
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
                  {trackerUi ? (
                    <>
                      <Fact
                        label={dict.courseDetail.freeDurability}
                        value={durability}
                      />
                      <Fact
                        label={dict.courseDetail.lastObserved}
                        value={
                          course.lastObservedAt
                            ? course.lastObservedAt.toLocaleString(locale)
                            : dict.courseDetail.unknown
                        }
                      />
                      <Fact
                        label={dict.courseDetail.trackerHeading}
                        value={lastVerifiedFreshnessLabel(
                          course.lastVerifiedAt,
                          locale,
                        )}
                      />
                    </>
                  ) : null}
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
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
                aria-label={dict.a11y.exploreRelated}
              >
                {course.categories.map((category) => (
                  <LocalizedLink
                    key={category.id}
                    href={`/category/${category.slug}`}
                    className="shrink-0 rounded-full border border-border px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:py-1.5"
                  >
                    {category.name}
                  </LocalizedLink>
                ))}
                <LocalizedLink
                  href={`/provider/${course.provider.slug}`}
                  className="shrink-0 rounded-full border border-border px-3 py-2 text-sm hover:bg-accent sm:py-1.5"
                >
                  {dict.courseDetail.moreFrom(course.provider.name)}
                </LocalizedLink>
                <LocalizedLink
                  href={bestHref}
                  className="shrink-0 rounded-full border border-border px-3 py-2 text-sm hover:bg-accent sm:py-1.5"
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

              <AffiliateResources
                heading={
                  locale === "vi"
                    ? "Gợi ý học thêm (tiếp thị)"
                    : "Related learning resources (affiliate)"
                }
                cards={affiliateCards}
              />
            </div>
          </div>
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
