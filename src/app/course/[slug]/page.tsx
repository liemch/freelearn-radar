import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseSection } from "@/components/public/course-section";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { VerificationFreshnessNotice } from "@/components/public/verification-freshness";
import { Button } from "@/components/ui/button";
import {
  findRelatedCourses,
  getCourseDetailBySlug,
} from "@/db/repositories/course-repository";
import {
  getCertificateTypeLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";
import {
  formatDuration,
  getRecommendationLabel,
} from "@/domain/course/recommendation";
import { withDb } from "@/lib/db-safe";

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

  return {
    title: `${course.title} | FreeLearn Radar`,
    description: course.shortDescription ?? course.description ?? undefined,
    alternates: {
      canonical: `/course/${course.slug}`,
    },
    openGraph: {
      title: course.title,
      description: course.shortDescription ?? course.description ?? undefined,
      url: `/course/${course.slug}`,
      type: "website",
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
      findRelatedCourses(
        db,
        course.id,
        course.categories.map((category) => category.id),
        4,
      ),
    [],
  );

  const price = getPriceTypeLabel(course.priceType);
  const certificate = getCertificateTypeLabel(course.certificateType);
  const duration = formatDuration(course.durationMinutes);
  const recommendation = getRecommendationLabel(course.qualityScore);
  const inactive =
    course.status === "EXPIRED" || course.status === "UNAVAILABLE";

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[2fr_1fr]">
        <article className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {course.provider.name}
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {course.title}
            </h1>
            <p className="text-muted-foreground">
              {course.shortDescription ?? "Curated free course."}
            </p>
          </div>

          {inactive ? (
            <p
              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-950"
              role="status"
            >
              This course or free offer may no longer be available. We keep the
              page for history — check the provider site, or browse related
              courses below.
            </p>
          ) : (
            <VerificationFreshnessNotice
              lastVerifiedAt={course.lastVerifiedAt}
              priceType={course.priceType}
            />
          )}

          <div
            className="flex flex-wrap items-center gap-2"
            aria-label="Course free status and details"
          >
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-4 py-1.5 text-base font-semibold text-emerald-900">
              <span aria-hidden="true" className="mr-1.5">
                {price.badge}
              </span>
              {price.label}
            </span>
            <span className="rounded-full border border-border bg-secondary px-3 py-1 text-sm">
              Certificate: {certificate}
            </span>
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
              Editorial signal: {recommendation}
            </span>
          </div>

          <section className="space-y-2" aria-labelledby="ai-summary-heading">
            <h2 id="ai-summary-heading" className="text-xl font-semibold">
              Editor summary
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {course.description || "No summary available yet."}
            </p>
          </section>

          <section
            className="grid gap-4 sm:grid-cols-2"
            aria-label="Course details"
          >
            <InfoItem label="Level" value={course.level.replace(/_/g, " ")} />
            <InfoItem label="Duration" value={duration ?? "Unknown"} />
            <InfoItem label="Language" value={course.language ?? "Unknown"} />
            <InfoItem label="Instructor" value={course.instructor ?? "Unknown"} />
            <InfoItem
              label="Last verified"
              value={
                course.lastVerifiedAt
                  ? course.lastVerifiedAt.toLocaleDateString()
                  : "Not verified"
              }
            />
            <InfoItem label="Provider" value={course.provider.name} />
          </section>

          <nav className="flex flex-wrap gap-2" aria-label="Categories">
            {course.categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {category.name}
              </Link>
            ))}
          </nav>

          <CourseSection
            title={inactive ? "Related alternatives" : "Related Courses"}
            courses={related}
          />
        </article>

        <aside className="h-fit space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-lg font-semibold">Visit Course</h2>
          <p className="text-sm text-muted-foreground">
            FreeLearn Radar links you to the original provider. We do not host
            the full course content. Free status is not guaranteed.
          </p>
          <Button asChild className="w-full" size="lg" variant={inactive ? "outline" : "default"}>
            <a href={`/course/${course.slug}/go`}>
              Go to {course.provider.name}
            </a>
          </Button>
          <p className="text-xs text-muted-foreground break-all">
            <span className="sr-only">Canonical URL: </span>
            {course.canonicalUrl}
          </p>
        </aside>
      </div>
      <SiteFooter />
    </main>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
