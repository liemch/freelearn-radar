import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseGrid } from "@/components/public/course-grid";
import { EmptyState } from "@/components/public/empty-state";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import { listPublishedCoursesWithProvider } from "@/db/repositories/course-repository";
import { selectMonthlyCollection } from "@/domain/discovery/monthly-collection";
import { buildItemListJsonLd } from "@/domain/seo/json-ld";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";

type BestPageProps = {
  params: Promise<{ locale: string; year: string; month: string }>;
};

function monthName(month: number) {
  return (
    [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ][month - 1] ?? "Unknown"
  );
}

export async function generateMetadata({
  params,
}: BestPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const { year, month } = await params;
  const monthNumber = Number(month);
  const period =
    locale === "vi"
      ? `tháng ${monthNumber}/${year}`
      : `${monthName(monthNumber)} ${year}`;
  const title =
    locale === "vi"
      ? `Khóa học miễn phí tốt nhất — ${period}`
      : `Best Free Online Courses — ${period}`;
  const path = localePath(locale, `/best/${year}/${month}`);

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  return {
    title: `${title} | FreeLearn Radar`,
    description:
      locale === "vi"
        ? `Khóa học miễn phí đáng học nhất ${period}, xếp theo chất lượng, độ tin cậy và thời điểm kiểm chứng.`
        : `Curated best free online courses for ${period}, ranked by quality, trust, and freshness.`,
    alternates: buildLocaleAlternates(appUrl, locale, `/best/${year}/${month}`),
    openGraph: {
      title,
      description:
        locale === "vi"
          ? `Khóa học miễn phí nổi bật ${period}.`
          : `Top free courses curated for ${period}.`,
      url: path,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description: `Best free courses for ${monthName(monthNumber)} ${year}.`,
    },
  };
}

export default async function BestCoursesPage({ params }: BestPageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const { year, month } = await params;
  const yearNumber = Number(year);
  const monthNumber = Number(month);

  if (
    !Number.isInteger(yearNumber) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    yearNumber < 2020 ||
    yearNumber > 2100
  ) {
    notFound();
  }

  const published = await withDb(
    "best.list",
    (db) => listPublishedCoursesWithProvider(db, 100),
    [],
  );

  const collection = selectMonthlyCollection(
    published,
    yearNumber,
    monthNumber,
    20,
  );

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  const monthLabel = `${monthName(monthNumber)} ${year}`;
  const title = dict.pages.bestHeading(monthLabel);

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <JsonLd
        data={buildItemListJsonLd({
          name: title,
          description: dict.pages.bestIntro,
          url: `${appUrl}/best/${year}/${month}`,
          courses: collection.items,
          appUrl,
        })}
      />
      <SiteHeader locale={locale} />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:space-y-8 sm:py-10 sm:px-6">
        <div className="space-y-2">
          <h1 className="font-display text-[1.75rem] font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="text-muted-foreground">{dict.pages.bestIntro}</p>
          <p className="text-sm text-muted-foreground">
            {collection.mode === "in_month"
              ? `${collection.inMonthCount} courses published this month · showing top ${collection.items.length}`
              : dict.pages.bestFallbackNotice}
          </p>
        </div>

        {collection.items.length === 0 ? (
          <EmptyState
            title={dict.pages.bestEmptyTitle}
            description={dict.pages.bestEmptyDescription}
            actionHref={localePath(locale, "/search")}
            actionLabel={dict.common.browseAll}
          />
        ) : (
          <CourseGrid
            courses={collection.items}
            locale={locale}
            priorityCount={4}
          />
        )}

        <p className="text-sm text-muted-foreground">
          <Link
            href={localePath(locale, "/search")}
            className="text-primary hover:underline"
          >
            {dict.nav.search}
          </Link>
          {" · "}
          <Link
            href={localePath(locale, "/free-certificate-courses")}
            className="text-primary hover:underline"
          >
            {dict.common.freeCertificates}
          </Link>
        </p>
      </div>
      <SiteFooter locale={locale} />
    </main>
  );
}
