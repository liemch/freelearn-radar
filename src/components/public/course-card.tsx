import { CourseCardVisual } from "@/components/public/course-card-visual";
import { FreeStatusBadge } from "@/components/public/free-status-badge";
import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";
import type { CourseWithProvider } from "@/db/repositories/course-repository";
import {
  formatLevelLabel,
  getCertificateTypeLabel,
} from "@/domain/course/labels";
import { formatDuration } from "@/domain/course/recommendation";
import {
  isStaleForPublicWarning,
  verificationAgeLabel,
} from "@/domain/verification/freshness-policy";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { localePath } from "@/lib/i18n/path";

type CourseCardProps = {
  course: CourseWithProvider;
  locale: Locale;
};

/**
 * Scan order: Visual → Free status → Title → Provider → Value → Meta → CTA
 * Links go through LocalizedLink so navigation tracks the live URL locale.
 */
export function CourseCard({ course, locale }: CourseCardProps) {
  const dict = getDictionary(locale);
  const certificate = getCertificateTypeLabel(course.certificateType, locale);
  const duration = formatDuration(course.durationMinutes);
  const stale = isStaleForPublicWarning(
    course.lastVerifiedAt,
    course.priceType,
  );
  const courseHref = localePath(locale, `/course/${course.slug}`);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border/70 transition hover:ring-primary/30 hover:shadow-md sm:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <LocalizedLink href={courseHref} className="block shrink-0">
        <CourseCardVisual course={course} locale={locale} />
      </LocalizedLink>

      <div className="flex flex-1 flex-col p-3.5 pt-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <FreeStatusBadge
            priceType={course.priceType}
            locale={locale}
            size="sm"
          />
          {course.certificateType !== "UNKNOWN" ? (
            <span className="text-xs text-muted-foreground">{certificate}</span>
          ) : null}
        </div>

        <h3 className="mt-2.5 text-base font-semibold leading-snug tracking-tight">
          <LocalizedLink
            href={courseHref}
            className="transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {course.title}
          </LocalizedLink>
        </h3>

        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {course.provider?.slug ? (
            <LocalizedLink
              href={localePath(locale, `/provider/${course.provider.slug}`)}
              className="hover:text-primary hover:underline"
            >
              {course.provider.name}
            </LocalizedLink>
          ) : (
            course.provider?.name || dict.common.unknown
          )}
        </p>

        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {course.shortDescription ?? dict.courseDetail.fallbackSummary}
        </p>

        <p className="mt-3 text-xs text-muted-foreground">
          <span>
            {course.level === "UNKNOWN"
              ? dict.course.levelUnknown
              : formatLevelLabel(course.level, locale)}
          </span>
          <span aria-hidden="true" className="mx-1.5 text-border">
            ·
          </span>
          <span>{duration ?? dict.course.durationUnknown}</span>
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {stale ? (
            <span className="text-amber-800 dark:text-amber-200">
              {dict.course.staleVerification} ·{" "}
              {verificationAgeLabel(
                course.lastVerifiedAt,
                undefined,
                dict.verification,
              )}
            </span>
          ) : (
            verificationAgeLabel(
              course.lastVerifiedAt,
              undefined,
              dict.verification,
            )
          )}
        </p>

        <div className="mt-4">
          <Button asChild className="h-11 w-full sm:h-8" size="sm">
            <LocalizedLink href={courseHref}>
              {dict.course.openCourse}
            </LocalizedLink>
          </Button>
        </div>
      </div>
    </article>
  );
}
