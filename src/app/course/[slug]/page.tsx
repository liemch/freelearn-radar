import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseSection } from "@/components/public/course-section";
import { SiteHeader } from "@/components/public/site-header";
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
    return { title: "Course not found" };
  }

  return {
    title: `${course.title} | FreeLearn Radar`,
    description: course.shortDescription ?? course.description ?? undefined,
  };
}

export default async function CourseDetailPage({ params }: CoursePageProps) {
  const { slug } = await params;
  const course = await withDb(
    "course.detail",
    (db) => getCourseDetailBySlug(db, slug),
    null,
  );

  if (!course || course.status !== "PUBLISHED") {
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

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[2fr_1fr]">
        <article className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {course.provider.name}
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {course.title}
            </h1>
            <p className="text-muted-foreground">
              {course.shortDescription ?? "Curated free course."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-secondary px-3 py-1">
              {price.badge} {price.label}
            </span>
            <span className="rounded-full bg-secondary px-3 py-1">
              🎓 {certificate}
            </span>
            <span className="rounded-full bg-secondary px-3 py-1">
              {recommendation}
            </span>
          </div>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">AI Summary</h2>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {course.description}
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
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
            <InfoItem label="Source" value={course.provider.name} />
          </section>

          <div className="flex flex-wrap gap-2">
            {course.categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent"
              >
                {category.name}
              </Link>
            ))}
          </div>

          <CourseSection title="Related Courses" courses={related} />
        </article>

        <aside className="h-fit space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-lg font-semibold">Visit Course</h2>
          <p className="text-sm text-muted-foreground">
            FreeLearn Radar links you to the original provider. We do not host
            the full course content.
          </p>
          <Button asChild className="w-full" size="lg">
            <a href={course.outboundUrl} target="_blank" rel="noreferrer">
              Go to {course.provider.name}
            </a>
          </Button>
          <p className="text-xs text-muted-foreground break-all">
            {course.canonicalUrl}
          </p>
        </aside>
      </div>
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
