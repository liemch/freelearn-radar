import Link from "next/link";

import { FreeStatusBadge } from "@/components/public/free-status-badge";
import { Button } from "@/components/ui/button";
import type { CourseWithProvider } from "@/db/repositories/course-repository";
import {
  formatLevelLabel,
  getCertificateTypeLabel,
} from "@/domain/course/labels";
import { formatDuration } from "@/domain/course/recommendation";
import { verificationAgeLabel } from "@/domain/verification/freshness-policy";
import { isStaleForPublicWarning } from "@/domain/verification/freshness-policy";

type CourseCardProps = {
  course: CourseWithProvider;
};

/**
 * Scan order: Free status → Title → Provider → Value → Level/Duration → Cert → CTA
 * Do not prioritize AI/editorial score on the card.
 */
export function CourseCard({ course }: CourseCardProps) {
  const certificate = getCertificateTypeLabel(course.certificateType);
  const duration = formatDuration(course.durationMinutes);
  const stale = isStaleForPublicWarning(
    course.lastVerifiedAt,
    course.priceType,
  );

  return (
    <article className="group flex h-full flex-col rounded-xl border border-border/80 bg-card p-5 shadow-sm transition hover:border-primary/25 hover:shadow-md">
      <div className="flex flex-wrap items-start gap-2">
        <FreeStatusBadge priceType={course.priceType} size="md" />
        {course.certificateType !== "UNKNOWN" ? (
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {certificate}
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight">
        <Link
          href={`/course/${course.slug}`}
          className="transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {course.title}
        </Link>
      </h3>

      <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {course.provider?.slug ? (
          <Link
            href={`/provider/${course.provider.slug}`}
            className="hover:text-primary hover:underline"
          >
            {course.provider.name}
          </Link>
        ) : (
          course.provider?.name || "Unknown provider"
        )}
      </p>

      <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
        {course.shortDescription ?? "Curated free course worth exploring."}
      </p>

      <p className="mt-3 text-sm text-muted-foreground">
        <span>{formatLevelLabel(course.level)}</span>
        <span aria-hidden="true" className="mx-1.5 text-border">
          ·
        </span>
        <span>{duration ?? "Duration unknown"}</span>
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {stale ? (
          <span className="text-amber-800">
            Free status may be outdated ·{" "}
            {verificationAgeLabel(course.lastVerifiedAt)}
          </span>
        ) : (
          verificationAgeLabel(course.lastVerifiedAt)
        )}
      </p>

      <div className="mt-5">
        <Button asChild className="w-full" variant="secondary">
          <Link href={`/course/${course.slug}`}>Open course</Link>
        </Button>
      </div>
    </article>
  );
}
