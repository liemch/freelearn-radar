import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CourseSection } from "@/components/public/course-section";
import { FreeStatusBadge } from "@/components/public/free-status-badge";
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

type CoursePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await withDb(
    "course.metadata",
    (db) => getCourseDetailBySlug(db, slug),
    null,
  );

  if (!course) {
    return { title: "Course not found", robots: { index: false, follow: false } };
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

  return {
    title: `${course.title} | FreeLearn Radar`,
    description,
    alternates: { canonical: `/course/${course.slug}` },
    openGraph: {
      title: course.title,
      description,
      url: `/course/${course.slug}`,
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

  const price = getPriceTypeLabel(course.priceType);
  const certificate = getCertificateTypeLabel(course.certificateType);
  const duration = formatDuration(course.durationMinutes);
  const inactive =
    course.status === "EXPIRED" || course.status === "UNAVAILABLE";

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  const shareUrl = `${appUrl}/course/${course.slug}`;
  const bestHref = currentBestPath();

  return (
    <main className="min-h-screen bg-background">
      <JsonLd
        data={buildCourseJsonLd({
          course,
          providerName: course.provider.name,
          appUrl,
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", url: `${appUrl}/` },
          {
            name: course.provider.name,
            url: `${appUrl}/provider/${course.provider.slug}`,
          },
          { name: course.title, url: shareUrl },
        ])}
      />
      <SiteHeader />
      <PageShell>
        <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
          <article className="space-y-8">
            <header className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                <Link
                  href={`/provider/${course.provider.slug}`}
                  className="hover:text-primary hover:underline"
                >
                  {course.provider.name}
                </Link>
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {course.title}
              </h1>
              <p className="max-w-2xl text-muted-foreground text-pretty">
                {course.shortDescription ?? "Curated free course."}
              </p>

              {inactive ? (
                <p
                  className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-950"
                  role="status"
                >
                  This course or free offer may no longer be available. Check the
                  provider site, or browse related courses below.
                </p>
              ) : (
                <VerificationFreshnessNotice
                  lastVerifiedAt={course.lastVerifiedAt}
                  priceType={course.priceType}
                />
              )}

              <div
                className="flex flex-wrap items-center gap-2"
                aria-label="Free status and certificate"
              >
                <FreeStatusBadge priceType={course.priceType} size="lg" />
                <span className="rounded-full border border-border bg-secondary px-3 py-1 text-sm">
                  {certificate}
                </span>
              </div>
            </header>

            <section aria-labelledby="facts-heading" className="space-y-3">
              <h2 id="facts-heading" className="text-lg font-semibold">
                Key facts
              </h2>
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <Fact label="What is free" value={price.label} hint={price.shortHint} />
                <Fact label="Certificate" value={certificate} />
                <Fact label="Level" value={formatLevelLabel(course.level)} />
                <Fact label="Duration" value={duration ?? "Unknown"} />
                <Fact label="Language" value={course.language ?? "Unknown"} />
                <Fact
                  label="Instructor"
                  value={course.instructor ?? "Not listed"}
                />
                <Fact
                  label="Last verified"
                  value={
                    course.lastVerifiedAt
                      ? course.lastVerifiedAt.toLocaleDateString()
                      : "Not verified"
                  }
                />
                <Fact label="Provider" value={course.provider.name} />
              </dl>
            </section>

            <section className="space-y-2" aria-labelledby="why-heading">
              <h2 id="why-heading" className="text-lg font-semibold">
                Why learn this
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {course.description || "No summary available yet."}
              </p>
            </section>

            <nav className="flex flex-wrap gap-2" aria-label="Explore related">
              {course.categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {category.name}
                </Link>
              ))}
              <Link
                href={`/provider/${course.provider.slug}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent"
              >
                More from {course.provider.name}
              </Link>
              <Link
                href={bestHref}
                className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent"
              >
                Monthly best
              </Link>
            </nav>

            <CourseSection
              title={inactive ? "Related alternatives" : "Related courses"}
              courses={related}
            />
          </article>

          <aside className="h-fit space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-lg font-semibold">View course</h2>
            <p className="text-sm text-muted-foreground">
              Continues on {course.provider.name}. FreeLearn Radar does not host
              lessons. Free status is not guaranteed.
            </p>
            <Button
              asChild
              className="w-full"
              size="lg"
              variant={inactive ? "outline" : "default"}
            >
              <a href={`/course/${course.slug}/go`}>
                View course on {course.provider.name}
              </a>
            </Button>
            <ShareCourseButton title={course.title} url={shareUrl} />
            <p className="sr-only">Source URL: {course.canonicalUrl}</p>
          </aside>
        </div>
      </PageShell>
      <SiteFooter />
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
