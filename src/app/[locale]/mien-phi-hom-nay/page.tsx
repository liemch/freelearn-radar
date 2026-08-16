import type { Metadata } from "next";

import { DailyFreeGrid } from "@/components/public/daily-free-card";
import { EmptyState } from "@/components/public/empty-state";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PageShell, PageStack } from "@/components/layout/page-shell";
import { listCategories } from "@/db/repositories/category-repository";
import { mapCourseIdsToPrimaryCategorySlug } from "@/db/repositories/course-repository";
import {
  groupDailyFreeByCategory,
  queryDailyFreeDeals,
  type DailyFreeItem,
} from "@/domain/discovery/daily-free";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";

// Read-only daily deals surface — cache and refresh periodically instead of
// hitting the DB on every navigation (deals rotate at most daily).
export const revalidate = 300;

type DailyFreePageProps = {
  params: Promise<{ locale: string }>;
};

function couponPublicSurfaceEnabled(): boolean {
  try {
    return getServerEnv().FEATURE_COUPON_PUBLIC_SURFACE === "true";
  } catch {
    return process.env.FEATURE_COUPON_PUBLIC_SURFACE === "true";
  }
}

export async function generateMetadata({
  params,
}: DailyFreePageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const path = localePath(locale, "/mien-phi-hom-nay");

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  return {
    title: `${dict.pages.dailyFreeHeading} | FreeLearn Radar`,
    description: dict.pages.dailyFreeIntro,
    alternates: buildLocaleAlternates(appUrl, locale, "/mien-phi-hom-nay"),
    openGraph: {
      title: dict.pages.dailyFreeHeading,
      description: dict.pages.dailyFreeIntro,
      url: path,
      type: "website",
    },
  };
}

export default async function DailyFreePage({ params }: DailyFreePageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const surfaceOn = couponPublicSurfaceEnabled();

  const deals = await withDb(
    "daily-free.deals",
    (db) => queryDailyFreeDeals(db, { limit: 48 }),
    [] as DailyFreeItem[],
  );

  const [categorySlugByCourseId, categories] = await Promise.all([
    withDb(
      "daily-free.category-slugs",
      (db) =>
        mapCourseIdsToPrimaryCategorySlug(
          db,
          deals.map((item) => item.course.id),
        ),
      new Map<string, string>(),
    ),
    withDb("daily-free.categories", (db) => listCategories(db), []),
  ]);

  const categoryNameById = new Map(
    categories.map((category) => [category.slug, category.name]),
  );
  const categoryNameByCourseId = new Map<string, string>();
  for (const [courseId, slug] of categorySlugByCourseId) {
    const name = categoryNameById.get(slug);
    if (name) categoryNameByCourseId.set(courseId, name);
  }

  const grouped = groupDailyFreeByCategory(deals, categorySlugByCourseId);
  const groupEntries = [...grouped.entries()].sort((a, b) => {
    if (a[0] === "khac") return 1;
    if (b[0] === "khac") return -1;
    const nameA = categoryNameById.get(a[0]) ?? a[0];
    const nameB = categoryNameById.get(b[0]) ?? b[0];
    return nameA.localeCompare(nameB, "vi");
  });

  const showGrouped = deals.length >= 8 && groupEntries.length > 1;

  return (
    <main className="flex min-h-screen flex-col">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <PageShell>
        <PageStack>
          <header className="space-y-2">
            <h1 className="font-display text-[1.75rem] font-semibold tracking-tight sm:text-3xl">
              {dict.pages.dailyFreeHeading}
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              {dict.pages.dailyFreeIntro}
            </p>
            {!surfaceOn && deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {locale === "vi"
                  ? "Bề mặt công khai coupon đang tắt hoặc chưa có dữ liệu xác minh."
                  : "Coupon public surface is off or no verified deals yet."}
              </p>
            ) : null}
          </header>

          {deals.length === 0 ? (
            <EmptyState
              title={dict.pages.dailyFreeEmptyTitle}
              description={dict.pages.dailyFreeEmptyDescription}
              actionHref={localePath(locale, "/search?price=FREE_FULL")}
              actionLabel={dict.sections.durableFree}
            />
          ) : showGrouped ? (
            <div className="space-y-8 sm:space-y-10">
              {groupEntries.map(([slug, items]) => (
                <section key={slug} className="space-y-3 sm:space-y-4">
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    {slug === "khac"
                      ? locale === "vi"
                        ? "Khác"
                        : "Other"
                      : (categoryNameById.get(slug) ?? slug)}
                  </h2>
                  <DailyFreeGrid
                    items={items}
                    locale={locale}
                    categoryNames={categoryNameByCourseId}
                    priorityCount={slug === groupEntries[0]?.[0] ? 4 : 0}
                  />
                </section>
              ))}
            </div>
          ) : (
            <DailyFreeGrid
              items={deals}
              locale={locale}
              categoryNames={categoryNameByCourseId}
              priorityCount={4}
            />
          )}
        </PageStack>
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
