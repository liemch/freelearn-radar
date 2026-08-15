import { CourseCardVisual } from "@/components/public/course-card-visual";
import { LocalizedLink } from "@/components/public/localized-link";
import { Badge } from "@/components/ui/badge";
import { getCourseVisual } from "@/domain/course/course-visual";
import type { DailyFreeItem } from "@/domain/discovery/daily-free";
import { formatVerificationFreshnessVi } from "@/domain/discovery/daily-free";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { localePath } from "@/lib/i18n/path";

type DailyFreeCardProps = {
  item: DailyFreeItem;
  locale: Locale;
  categoryName?: string | null;
  priority?: boolean;
};

/**
 * The verified "Coupon 100%" label means the offer was checked against the
 * provider. A catalog row carrying `FREE_WITH_COUPON` has no offer-level
 * verification behind it, so it gets a weaker label instead of borrowing this
 * one (§120: only verified 100% off may claim "Coupon 100%").
 */
function offerBadge(
  item: Pick<DailyFreeItem, "offerStatus" | "couponVerified">,
  labels: { coupon: string; couponUnverified: string; limited: string },
): { label: string; variant: "warning" | "brand" | "neutral" } | null {
  if (item.offerStatus === "ACTIVE_100_OFF" && item.couponVerified) {
    return { label: labels.coupon, variant: "warning" };
  }
  if (item.offerStatus === "FREE_WITH_COUPON") {
    return { label: labels.couponUnverified, variant: "neutral" };
  }
  if (item.offerStatus === "TEMPORARILY_FREE") {
    return { label: labels.limited, variant: "brand" };
  }
  return null;
}

/**
 * Daily-free surface card: coupon/limited badge, real freshness, clear CTA.
 * Links to the course detail page (coupon redeem happens on the provider).
 */
export function DailyFreeCard({
  item,
  locale,
  categoryName,
  priority,
}: DailyFreeCardProps) {
  const dict = getDictionary(locale);
  const { course } = item;
  const visual = getCourseVisual(course);
  const courseHref = localePath(locale, `/course/${course.slug}`);
  const badge = offerBadge(item, {
    coupon: dict.pages.coupon100Badge,
    couponUnverified: dict.pages.couponUnverifiedBadge,
    limited: dict.pages.limitedFreeBadge,
  });
  const freshness =
    locale === "vi"
      ? formatVerificationFreshnessVi(item.verifiedAt ?? course.lastVerifiedAt)
      : null;
  const showCouponCta =
    item.offerStatus === "ACTIVE_100_OFF" && item.couponVerified;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition hover:border-primary/40 hover:shadow-md focus-within:border-primary/40 motion-reduce:transition-none">
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

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[0.9375rem] font-semibold leading-snug tracking-tight">
          <LocalizedLink
            href={courseHref}
            className="rounded-sm after:absolute after:inset-0 after:content-[''] group-hover:text-primary"
          >
            {course.title}
          </LocalizedLink>
        </h3>

        <p className="mt-1 text-xs text-muted-foreground">
          {course.provider?.name || dict.common.unknown}
          {categoryName ? (
            <>
              <span aria-hidden="true" className="mx-1.5 text-border">
                ·
              </span>
              <span>{categoryName}</span>
            </>
          ) : null}
        </p>

        {badge ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        ) : null}

        {freshness ? (
          <p className="mt-3 text-xs text-muted-foreground">{freshness}</p>
        ) : null}

        {showCouponCta ? (
          <p className="relative z-10 mt-auto pt-3 text-sm font-medium text-primary">
            {dict.pages.dailyFreeCta}
          </p>
        ) : (
          <p className="mt-auto pt-3 text-sm font-medium text-primary">
            {dict.course.openCourse}
          </p>
        )}
      </div>
    </article>
  );
}

export function DailyFreeGrid({
  items,
  locale,
  categoryNames,
  priorityCount = 0,
}: {
  items: DailyFreeItem[];
  locale: Locale;
  categoryNames?: Map<string, string>;
  priorityCount?: number;
}) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(17rem,100%),1fr))] gap-4">
      {items.map((item, index) => (
        <DailyFreeCard
          key={item.course.id}
          item={item}
          locale={locale}
          categoryName={categoryNames?.get(item.course.id) ?? null}
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}
