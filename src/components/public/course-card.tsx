import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { CourseWithProvider } from "@/db/repositories/course-repository";
import {
  getCertificateTypeLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";
import {
  formatDuration,
  getRecommendationLabel,
} from "@/domain/course/recommendation";

type CourseCardProps = {
  course: CourseWithProvider;
};

export function CourseCard({ course }: CourseCardProps) {
  const price = getPriceTypeLabel(course.priceType);
  const certificate = getCertificateTypeLabel(course.certificateType);
  const duration = formatDuration(course.durationMinutes);
  const recommendation = getRecommendationLabel(course.qualityScore);

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {course.provider.name}
        </p>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
          {recommendation}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-snug">
        <Link href={`/course/${course.slug}`} className="hover:text-primary">
          {course.title}
        </Link>
      </h3>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <span>
          {price.badge} {price.label}
        </span>
        <span className="text-muted-foreground">🎓 {certificate}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span>{course.level.replace(/_/g, " ").toLowerCase()}</span>
        {duration ? <span>{duration}</span> : null}
        {course.language ? <span>{course.language}</span> : null}
      </div>

      <p className="mt-3 flex-1 text-sm text-muted-foreground">
        {course.shortDescription ?? "Curated free course worth exploring."}
      </p>

      <div className="mt-4">
        <Button asChild className="w-full">
          <Link href={`/course/${course.slug}`}>View Course</Link>
        </Button>
      </div>
    </article>
  );
}
