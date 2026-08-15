import { CourseCardVisual } from "@/components/public/course-card-visual";
import { FreeStatusBadge } from "@/components/public/free-status-badge";
import { LocalizedLink } from "@/components/public/localized-link";
import { Badge } from "@/components/ui/badge";
import type { CourseWithProvider } from "@/db/repositories/course-repository";
import { getCourseVisual } from "@/domain/course/course-visual";
import {
  formatLevelLabel,
  getCertificateTypeLabel,
} from "@/domain/course/labels";
import { formatDuration } from "@/domain/course/recommendation";
import {
  freeDurabilityLabel,
  selectCourseBadgeSlots,
} from "@/domain/tracker/vocabulary";
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
  /** Set on the first row of the first grid so the hero images load eagerly. */
  priority?: boolean;
};

/**
 * Scan order: visual → title → provider → truth badges → effort → freshness.
 *
 * Answers quickly: what / where / what kind of free / when verified.
 */
export function CourseCard({ course, locale, priority }: CourseCardProps) {
  const dict = getDictionary(locale);
  const visual = getCourseVisual(course);
  const certificate = getCertificateTypeLabel(course.certificateType, locale);
  const duration = formatDuration(course.durationMinutes);
  const stale = isStaleForPublicWarning(course.lastVerifiedAt, course.priceType);
  const courseHref = localePath(locale, `/course/${course.slug}`);
  const badgeSlots = selectCourseBadgeSlots({
    certificateKnown: course.certificateType !== "UNKNOWN",
    freeDurability: course.freeDurability ?? "UNKNOWN",
  });
  const durability = freeDurabilityLabel(
    course.freeDurability ?? "UNKNOWN",
    locale,
  );
  const freshness = verificationAgeLabel(
    course.lastVerifiedAt,
    undefined,
    dict.verification,
  );

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card focus-within:border-primary/40 motion-reduce:transform-none motion-reduce:transition-none">
      <div className="relative">
        <CourseCardVisual
          src={visual.src}
          eyebrow={visual.eyebrow}
          title={visual.title}
          toneClass={visual.toneClass}
          priority={priority}
        />
        {visual.src && course.provider?.name ? (
          <span className="absolute left-3 top-3 rounded-md bg-background/92 px-2 py-1 text-[0.6875rem] font-semibold text-foreground shadow-sm backdrop-blur-sm">
            {course.provider.name}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h3 className="text-[0.9375rem] font-semibold leading-snug tracking-tight">
          <LocalizedLink
            href={courseHref}
            className="rounded-sm after:absolute after:inset-0 after:content-[''] group-hover:text-primary"
          >
            {course.title}
          </LocalizedLink>
        </h3>

        <p className="text-xs text-muted-foreground">
          {course.provider?.slug ? (
            <LocalizedLink
              href={localePath(locale, `/provider/${course.provider.slug}`)}
              className="relative z-10 hover:text-primary hover:underline"
            >
              {course.provider.name}
            </LocalizedLink>
          ) : (
            course.provider?.name || dict.common.unknown
          )}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {badgeSlots.includes("price") ? (
            <FreeStatusBadge
              priceType={course.priceType}
              locale={locale}
              size="sm"
            />
          ) : null}
          {badgeSlots.includes("certificate") ? (
            <Badge variant="outline">{certificate}</Badge>
          ) : null}
          {badgeSlots.includes("durability") ? (
            <Badge variant="outline">{durability}</Badge>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
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

        <p
          className={
            stale
              ? "mt-auto pt-1 text-xs font-medium text-warning-foreground"
              : "mt-auto pt-1 text-xs text-muted-foreground"
          }
        >
          {stale ? `${dict.course.staleVerification} · ${freshness}` : freshness}
        </p>
      </div>
    </article>
  );
}
