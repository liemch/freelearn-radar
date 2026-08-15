import { BadgeCheck, CalendarCheck, Layers, Ticket } from "lucide-react";

import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { verificationAgeLabel } from "@/domain/verification/freshness-policy";

type TrustStripProps = {
  locale: Locale;
  publishedCount: number;
  providerCount: number;
  lastVerifiedAt: Date | null;
  /** Verified ACTIVE_100_OFF offers currently eligible — omit when 0. */
  activeCouponCount?: number;
};

/**
 * Trust metrics under the hero. Every figure is real; empty metrics are omitted.
 */
export function TrustStrip({
  locale,
  publishedCount,
  providerCount,
  lastVerifiedAt,
  activeCouponCount = 0,
}: TrustStripProps) {
  const dict = getDictionary(locale);

  const items: Array<{
    Icon: typeof BadgeCheck;
    value: string;
    label: string;
    hint: string;
  }> = [];

  if (publishedCount > 0) {
    items.push({
      Icon: BadgeCheck,
      value: publishedCount.toLocaleString(locale === "vi" ? "vi-VN" : "en-US"),
      label: dict.trust.verifiedCourses,
      hint: dict.trust.verifiedCoursesHint,
    });
  }

  if (providerCount > 0) {
    items.push({
      Icon: Layers,
      value: String(providerCount),
      label: dict.trust.providersTracked,
      hint: dict.trust.providersTrackedHint,
    });
  }

  if (activeCouponCount > 0) {
    items.push({
      Icon: Ticket,
      value: activeCouponCount.toLocaleString(
        locale === "vi" ? "vi-VN" : "en-US",
      ),
      label: dict.trust.activeCoupons,
      hint: dict.trust.activeCouponsHint,
    });
  }

  if (lastVerifiedAt) {
    items.push({
      Icon: CalendarCheck,
      value: "",
      label: verificationAgeLabel(lastVerifiedAt, undefined, dict.verification),
      hint: dict.trust.lastChecked,
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-border/50 bg-card/80">
      <div className="page-gutter grid gap-3 py-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 shadow-sm"
          >
            <item.Icon
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm leading-snug">
                {item.value ? (
                  <span className="font-semibold tabular-nums">{item.value} </span>
                ) : null}
                <span
                  className={
                    item.value ? "text-muted-foreground" : "font-semibold"
                  }
                >
                  {item.label}
                </span>
              </p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {item.hint}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
