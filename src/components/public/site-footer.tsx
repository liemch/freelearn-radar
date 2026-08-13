import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { currentBestPath } from "@/domain/discovery/monthly-collection";
import { DURATION_BUCKETS } from "@/domain/course/catalog-query";
import { listTopicSlugs } from "@/domain/discovery/topic-landings";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { localePath } from "@/lib/i18n/path";

type SiteFooterProps = {
  locale: Locale;
};

export function SiteFooter({ locale }: SiteFooterProps) {
  const dict = getDictionary(locale);
  const bestHref = localePath(locale, currentBestPath());
  const topics = listTopicSlugs().slice(0, 6);

  return (
    <footer className="mt-auto border-t border-border/60 bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2.5">
            <BrandMark className="size-6 text-primary" />
            <p className="font-display text-lg font-semibold">FreeLearn Radar</p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {dict.footer.tagline}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold">
            {locale === "vi" ? "Khám phá" : "Discover"}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link
                href={localePath(locale, "/search")}
                className="hover:text-foreground"
              >
                {locale === "vi" ? "Tìm kiếm" : "Search"}
              </Link>
            </li>
            <li>
              <Link
                href={localePath(locale, "/free-certificate-courses")}
                className="hover:text-foreground"
              >
                {locale === "vi" ? "Chứng chỉ miễn phí" : "Free certificates"}
              </Link>
            </li>
            <li>
              <Link
                href={localePath(locale, `/collections/${DURATION_BUCKETS.under_1h.slug}`)}
                className="hover:text-foreground"
              >
                {locale === "vi" ? "Dưới 1 giờ" : "Under 1 hour"}
              </Link>
            </li>
            <li>
              <Link href={bestHref} className="hover:text-foreground">
                {locale === "vi" ? "Hay nhất tháng" : "Best this month"}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">
            {locale === "vi" ? "Chủ đề" : "Topics"}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {topics.map((slug) => (
              <li key={slug}>
                <Link
                  href={localePath(locale, `/free-courses/${slug}`)}
                  className="capitalize hover:text-foreground"
                >
                  {slug.replace(/-/g, " ")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
