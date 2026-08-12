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

function priceTone(priceType: CourseWithProvider["priceType"]): string {
  switch (priceType) {
    case "FREE_FULL":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "TEMPORARILY_FREE":
      return "bg-orange-100 text-orange-900 border-orange-200";
    case "FREE_WITH_COUPON":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "FREE_AUDIT":
      return "bg-sky-100 text-sky-900 border-sky-200";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export function CourseCard({ course }: CourseCardProps) {
  const price = getPriceTypeLabel(course.priceType);
  const certificate = getCertificateTypeLabel(course.certificateType);
  const duration = formatDuration(course.durationMinutes);
  const recommendation = getRecommendationLabel(course.qualityScore);

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {course.provider?.name || "Unknown provider"}
        </p>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {recommendation}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight">
        <Link
          href={`/course/${course.slug}`}
          className="transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {course.title}
        </Link>
      </h3>

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${priceTone(course.priceType)}`}
        >
          <span aria-hidden="true" className="mr-1.5">
            {price.badge}
          </span>
          {price.label}
        </span>
        <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
          {certificate}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="capitalize">
          {course.level.replace(/_/g, " ").toLowerCase()}
        </span>
        <span>{duration ?? "Duration unknown"}</span>
        <span>{course.language || "Language unknown"}</span>
      </div>

      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {course.shortDescription ?? "Curated free course worth exploring."}
      </p>

      <div className="mt-5">
        <Button asChild className="w-full">
          <Link href={`/course/${course.slug}`}>View course</Link>
        </Button>
      </div>
    </article>
  );
}
