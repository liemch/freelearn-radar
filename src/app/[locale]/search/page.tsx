import type { Metadata } from "next";

import { CatalogFiltersForm } from "@/components/public/catalog-filters";
import { CourseGrid } from "@/components/public/course-grid";
import { EmptyState } from "@/components/public/empty-state";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { Pagination } from "@/components/public/pagination";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PageShell } from "@/components/layout/page-shell";
import { listCategories } from "@/db/repositories/category-repository";
import { queryCatalog } from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { recordSearchQuery } from "@/db/repositories/search-query-repository";
import { LEXICAL_RANKING_CONFIG_VERSION } from "@/domain/search/lexical";
import { trackProductEvent } from "@/domain/analytics/product-events";
import {
  buildCatalogQuery,
  catalogFiltersToQuery,
} from "@/domain/course/catalog-query";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const raw = await searchParams;
  const hasFilters = Object.keys(raw).some(
    (key) => key !== "page" && raw[key],
  );

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  return {
    title:
      locale === "vi"
        ? "Tìm khóa học miễn phí | FreeLearn Radar"
        : "Search Free Courses | FreeLearn Radar",
    description: dict.search.description,
    alternates: buildLocaleAlternates(appUrl, locale, "/search"),
    robots: hasFilters
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title: dict.search.title,
      description: dict.search.description,
      url: localePath(locale, "/search"),
      type: "website",
    },
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: SearchPageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const raw = await searchParams;
  const urlParams = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      urlParams.set(key, value);
    }
  }

  let filters = buildCatalogQuery(urlParams);
  const searchStartedAt = Date.now();
  let retrievalMode: "LEXICAL" | "SEMANTIC" | "HYBRID" = "LEXICAL";
  let degraded = false;
  let unmetIntent: boolean | undefined;
  let lexicalWouldBeZero: boolean | null = null;
  let topScore: number | null = null;
  let rankingConfigVersion = LEXICAL_RANKING_CONFIG_VERSION;

  // Natural-language constraints ("dưới 3 giờ", "cho người mới") are extracted
  // deterministically before retrieval so they filter rather than being matched
  // as keywords. Flag-gated and OFF by default; failure keeps the raw query.
  try {
    if (
      getServerEnv().FEATURE_NL_COURSE_FINDER === "true" &&
      filters.q?.trim()
    ) {
      const { parseIntentDeterministic, applyNlIntentToFilters } = await import(
        "@/domain/search/nl-intent"
      );
      filters = applyNlIntentToFilters(
        filters,
        parseIntentDeterministic(filters.q),
      );
    }
  } catch {
    // Intent parsing is an optimisation, never a precondition for search.
  }

  let catalog = await withDb(
    "search.catalog",
    (db) => queryCatalog(db, filters),
    {
      items: [],
      total: 0,
      page: 1,
      pageSize: filters.pageSize ?? 12,
      totalPages: 1,
    },
  );

  // Hybrid/semantic only when flags are ON; otherwise keep lexical path.
  try {
    const env = getServerEnv();
    const hybridOn = env.FEATURE_HYBRID_SEARCH === "true";
    const semanticOn =
      env.FEATURE_SEMANTIC_SEARCH === "true" || hybridOn;
    if (semanticOn && filters.q?.trim()) {
      const hybrid = await withDb(
        "search.hybrid",
        async (db) => {
          const { searchHybrid } = await import("@/domain/search/hybrid");
          return searchHybrid(db, filters);
        },
        null,
      );
      if (!hybrid) {
        // The semantic path was expected and did not run. Recording this as a
        // healthy search would understate the §85 degraded rate.
        degraded = true;
      } else {
        retrievalMode = hybrid.retrievalMode;
        degraded = hybrid.degraded;
        unmetIntent = hybrid.unmetIntent;
        lexicalWouldBeZero = hybrid.lexicalWouldBeZero;
        topScore = hybrid.topScore;
        rankingConfigVersion = (
          await import("@/config/search-ranking")
        ).SEARCH_RANKING_CONFIG_VERSION;

        if (hybrid.courseIds.length > 0) {
          // Fusion can promote courses the lexical page never contained — the
          // whole point of semantic rescue — so results are hydrated from the
          // fused ids rather than reordering the lexical slice. `pageIds` is
          // already the slice for the requested page, and `courseIds` is the
          // full ranked set, so pagination describes the fused result set
          // rather than the lexical one.
          const { listEligibleCoursesByIds } = await import(
            "@/db/repositories/course-repository"
          );
          const fusedItems = hybrid.pageIds.length
            ? await withDb(
                "search.hydrate_fused",
                (db) => listEligibleCoursesByIds(db, hybrid.pageIds),
                [],
              )
            : [];

          // An empty page slice means the requested page is past the end of the
          // fused set, which is still a valid hybrid answer. Only fall back to
          // the lexical catalog when hydration itself came back empty for ids
          // we did ask for, since that indicates a failed read.
          const hydrationFailed =
            hybrid.pageIds.length > 0 && fusedItems.length === 0;

          if (!hydrationFailed) {
            const total = hybrid.courseIds.length;
            catalog = {
              ...catalog,
              items: fusedItems,
              total,
              totalPages: Math.max(1, Math.ceil(total / catalog.pageSize)),
            };
          } else {
            degraded = true;
          }
        } else if (hybrid.unmetIntent) {
          catalog = {
            ...catalog,
            items: [],
            total: 0,
            totalPages: 1,
          };
        }
      }
    }
  } catch {
    // Flag/env/hybrid failures must not break search — stay lexical, but the
    // request did run degraded.
    degraded = true;
  }

  const [providers, categories] = await Promise.all([
    withDb("search.providers", (db) => listProviders(db), []),
    withDb("search.categories", (db) => listCategories(db), []),
  ]);

  const latencyMs = Date.now() - searchStartedAt;

  trackProductEvent({
    event: "search",
    path: "/search",
    query: filters.q,
    resultCount: catalog.total,
    meta: { latencyMs, retrievalMode, degraded },
  });

  await withDb(
    "search.record_query",
    (db) =>
      recordSearchQuery(db, {
        rawQuery: filters.q,
        locale,
        resultCount: catalog.total,
        latencyMs,
        filtersJson: {
          providerSlug: filters.providerSlug ?? null,
          level: filters.level ?? null,
          language: filters.language ?? null,
          certificateType: filters.certificateType ?? null,
          priceType: filters.priceType ?? null,
          durationMaxMinutes: filters.durationMaxMinutes ?? null,
          sort: filters.sort ?? null,
          page: filters.page ?? 1,
        },
        retrievalMode,
        degraded,
        unmetIntent,
        lexicalWouldBeZero,
        topScore,
        rankingConfigVersion,
      }),
    null,
  );

  const hasNarrowingFilters = Boolean(
    filters.q ||
      filters.providerSlug ||
      filters.level ||
      filters.priceType ||
      filters.certificateType ||
      filters.durationMaxMinutes,
  );

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <PageShell className="space-y-6 py-7 sm:space-y-8 sm:py-10">
        <div className="space-y-3 rounded-2xl border border-border/60 bg-surface/80 px-4 py-5 sm:px-6 sm:py-6">
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight sm:text-4xl">
            {dict.search.title}
          </h1>
          <p className="max-w-2xl text-[0.9375rem] text-muted-foreground sm:text-base">
            {dict.search.description}
          </p>
          <p className="text-sm text-muted-foreground">
            {dict.search.results(catalog.total, filters.q)}
          </p>
        </div>

        <CatalogFiltersForm
          action="/search"
          filters={filters}
          providers={providers}
          categories={categories}
          showCategoryLinks
          labels={dict.filters}
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title={dict.empty.searchTitle}
            description={dict.empty.searchDescription}
            actionHref="/free-courses/ai"
            actionLabel={dict.empty.searchAction}
            // Offered only when a filter is what emptied the page.
            secondaryHref={hasNarrowingFilters ? "/search" : undefined}
            secondaryLabel={
              hasNarrowingFilters ? dict.filters.clearAll : undefined
            }
          />
        ) : (
          <CourseGrid
            courses={catalog.items}
            locale={locale}
            priorityCount={4}
          />
        )}

        <Pagination
          page={catalog.page}
          totalPages={catalog.totalPages}
          basePath="/search"
          query={catalogFiltersToQuery(filters)}
          labels={dict.pagination}
        />
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
