import { BadgeCheck, CalendarCheck, Eye, Layers } from "lucide-react";

import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { verificationAgeLabel } from "@/domain/verification/freshness-policy";

type TrustStripProps = {
  locale: Locale;
  publishedCount: number;
  providerCount: number;
  lastVerifiedAt: Date | null;
};

/**
 * Four proof points under the hero.
 *
 * Each numeric item renders only when the application can supply a real figure,
 * so a fresh deployment with an empty catalogue shows fewer items rather than
 * inventing plausible ones. The strip disappears entirely when nothing is known.
 */
export function TrustStrip({
  locale,
  publishedCount,
  providerCount,
  lastVerifiedAt,
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

  if (lastVerifiedAt) {
    items.push({
      Icon: CalendarCheck,
      value: verificationAgeLabel(lastVerifiedAt, undefined, dict.verification),
      label: dict.trust.lastChecked,
      hint: dict.trust.verifiedCoursesHint,
    });
  }

  if (items.length === 0) {
    return null;
  }

  items.push({
    Icon: Eye,
    value: "",
    label: dict.trust.transparency,
    hint: dict.trust.transparencyHint,
  });

  return (
    <section className="border-b border-border/50 bg-card">
      <div className="mx-auto grid w-full max-w-6xl gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-2.5">
            <item.Icon
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm leading-snug">
                {item.value ? (
                  <span className="font-semibold">{item.value} </span>
                ) : null}
                <span className={item.value ? "text-muted-foreground" : "font-semibold"}>
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
