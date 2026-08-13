import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { localePath } from "@/lib/i18n/path";
import { currentBestPath } from "@/domain/discovery/monthly-collection";

import { BrandMark } from "@/components/brand/brand-mark";
import { SiteHeaderClient } from "@/components/public/site-header-client";

type SiteHeaderProps = {
  locale: Locale;
};

export function SiteHeader({ locale }: SiteHeaderProps) {
  const dict = getDictionary(locale);
  const bestHref = localePath(locale, currentBestPath());

  const links = [
    { href: bestHref, label: dict.nav.explore },
    { href: localePath(locale, "/free-courses/ai"), label: dict.nav.categories },
    { href: localePath(locale, "/search"), label: dict.nav.search },
  ];

  return (
    <SiteHeaderClient
      locale={locale}
      homeHref={localePath(locale, "/")}
      links={links}
      languageLabel={dict.language.switchLabel}
      menuOpenLabel={dict.nav.menu}
      menuCloseLabel={dict.nav.close}
      brand={
        <>
          <BrandMark className="size-6 text-primary sm:size-7" />
          <span className="font-display text-base font-semibold tracking-tight sm:text-lg">
            FreeLearn Radar
          </span>
        </>
      }
    />
  );
}
