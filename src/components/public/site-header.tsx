import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { localePath } from "@/lib/i18n/path";
import { listTopicSlugs } from "@/domain/discovery/topic-landings";
import { getResolvedBranding } from "@/domain/branding/get-resolved-branding";
import { getServerEnv } from "@/lib/env";

import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteHeaderClient } from "@/components/public/site-header-client";

type SiteHeaderProps = {
  locale: Locale;
};

function discoveryUxEnabled(locale: Locale): boolean {
  try {
    return getServerEnv().FEATURE_DISCOVERY_UX === "true" || locale === "vi";
  } catch {
    return process.env.FEATURE_DISCOVERY_UX === "true" || locale === "vi";
  }
}

function learningPathsEnabled(): boolean {
  try {
    return getServerEnv().FEATURE_LEARNING_PATHS === "true";
  } catch {
    return process.env.FEATURE_LEARNING_PATHS === "true";
  }
}

export async function SiteHeader({ locale }: SiteHeaderProps) {
  const dict = getDictionary(locale);
  const discoveryUx = discoveryUxEnabled(locale);
  const learningPaths = learningPathsEnabled();
  const firstTopic = listTopicSlugs()[0] ?? "ai";

  const branding = await getResolvedBranding();

  const hero = branding?.hero ?? {
    searchPlaceholder: dict.hero.searchPlaceholder,
  };

  const links = discoveryUx
    ? [
        { href: localePath(locale, "/search"), label: dict.nav.courses },
        {
          href: localePath(locale, "/mien-phi-hom-nay"),
          label: dict.nav.dailyFree,
        },
        {
          href: localePath(locale, `/free-courses/${firstTopic}`),
          label: dict.nav.topics,
        },
        {
          href: localePath(locale, "/category/soft-skills"),
          label: dict.nav.directory,
        },
        ...(learningPaths
          ? [
              {
                href: localePath(locale, "/path"),
                label: dict.nav.learningPaths,
              },
            ]
          : []),
      ]
    : [
        {
          href: localePath(locale, "/search"),
          label: dict.nav.search,
        },
        {
          href: localePath(locale, `/free-courses/${firstTopic}`),
          label: dict.nav.categories,
        },
        ...(learningPaths
          ? [
              {
                href: localePath(locale, "/path"),
                label: dict.nav.learningPaths,
              },
            ]
          : []),
      ];

  return (
    <SiteHeaderClient
      locale={locale}
      homeHref={localePath(locale, "/")}
      links={links}
      languageLabel={dict.language.switchLabel}
      menuOpenLabel={dict.nav.menu}
      menuCloseLabel={dict.nav.close}
      searchPlaceholder={hero.searchPlaceholder}
      searchButtonLabel={dict.hero.searchButton}
      showHotBadge={discoveryUx}
      hotBadgeLabel="HOT"
      brand={
        <>
          <BrandLogo
            logoUrl={branding?.logoUrl}
            compactUrl={branding?.logoCompactUrl}
            title="FreeLearn Radar"
          />
          {!branding?.logoUrl && !branding?.logoCompactUrl ? (
            <span className="truncate font-display text-base font-semibold tracking-tight sm:text-lg">
              FreeLearn Radar
            </span>
          ) : null}
        </>
      }
    />
  );
}
