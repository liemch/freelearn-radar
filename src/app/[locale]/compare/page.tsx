import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { LocalizedLink } from "@/components/public/localized-link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  findCourseById,
  findCourseBySlug,
} from "@/db/repositories/course-repository";
import { findProviderById } from "@/db/repositories/provider-repository";
import {
  buildCourseComparison,
  isUuid,
  parseCompareIds,
  type ComparableCourse,
  type ComparisonRowKey,
} from "@/domain/search/compare-courses";
import {
  formatLevelLabel,
  getCertificateTypeLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";
import { formatDuration } from "@/domain/course/recommendation";
import { freeDurabilityLabel } from "@/domain/tracker/vocabulary";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import { resolveLocaleParam } from "@/lib/i18n/page";

/**
 * The feature gate has to be evaluated per request — see the note on the
 * learning-path page. A prerendered gate is a redeploy, not a kill switch.
 */
export const dynamic = "force-dynamic";

type ComparePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function compareEnabled(): boolean {
  try {
    return getServerEnv().FEATURE_COURSE_COMPARE === "true";
  } catch {
    return process.env.FEATURE_COURSE_COMPARE === "true";
  }
}

export async function generateMetadata({
  params,
}: ComparePageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);

  if (!compareEnabled()) {
    return {
      title: "Not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title:
      locale === "vi"
        ? "So sánh khóa học | FreeLearn Radar"
        : "Compare Courses | FreeLearn Radar",
    robots: { index: false, follow: true },
  };
}

export default async function ComparePage({
  params,
  searchParams,
}: ComparePageProps) {
  const locale = await resolveLocaleParam(params);

  if (!compareEnabled()) {
    notFound();
  }

  const raw = await searchParams;
  const ids = parseCompareIds(raw.ids ?? raw.compare);

  const loaded = await withDb(
    "compare.courses",
    async (db) => {
      const items: ComparableCourse[] = [];
      for (const id of ids) {
        // §94.3 describes the shareable form as `?compare=slug-a,slug-b`, so a
        // slug has to resolve. Ids stay supported for links already in the wild.
        const course = isUuid(id)
          ? await findCourseById(db, id)
          : await findCourseBySlug(db, id);
        if (!course || course.status !== "PUBLISHED") continue;
        const provider = await findProviderById(db, course.providerId);
        items.push({
          id: course.id,
          title: course.title,
          providerName: provider?.name ?? "Unknown",
          priceType: course.priceType,
          certificateType: course.certificateType,
          level: course.level,
          durationMinutes: course.durationMinutes,
          language: course.language,
          freeDurability: course.freeDurability,
        });
      }
      return items;
    },
    [] as ComparableCourse[],
  );

  const comparison = buildCourseComparison(loaded);
  const vi = locale === "vi";

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <PageShell>
        <div className="space-y-6 py-8">
          <header className="space-y-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {vi ? "So sánh khóa học" : "Compare courses"}
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              {vi
                ? "So sánh thông tin thực tế của tối đa 3 khóa học. Chúng tôi không xếp hạng khóa nào là \"tốt nhất\"."
                : "Side-by-side facts for up to 3 courses. We do not judge which one is \"best\"."}
            </p>
          </header>

          {comparison.courses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <h2 className="text-lg font-semibold">
                {vi ? "Chưa có khóa học để so sánh" : "No courses to compare"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {vi
                  ? "Thêm khóa học qua tham số ?ids=id1,id2,id3 hoặc tìm khóa học trước."
                  : "Add courses via ?ids=id1,id2,id3 or find courses first."}
              </p>
              <LocalizedLink
                href="/search"
                className="mt-4 inline-block text-sm text-primary hover:underline"
              >
                {vi ? "Tìm khóa học miễn phí" : "Search free courses"}
              </LocalizedLink>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {vi ? "Thông tin" : "Fact"}
                    </th>
                    {comparison.courses.map((course) => (
                      <th
                        key={course.id}
                        className="px-4 py-3 text-left font-semibold"
                      >
                        {course.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(
                    [
                      "provider",
                      "priceType",
                      "certificateType",
                      "level",
                      "duration",
                      "language",
                      "freeDurability",
                    ] as ComparisonRowKey[]
                  ).map((key) => (
                    <tr key={key}>
                      <th className="px-4 py-3 text-left align-top font-medium text-muted-foreground">
                        {rowLabel(key, locale)}
                      </th>
                      {comparison.courses.map((course) => (
                        <td key={course.id} className="px-4 py-3 align-top">
                          {formatRowValue(key, course, locale)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}

function rowLabel(key: ComparisonRowKey, locale: Locale): string {
  const vi = locale === "vi";
  switch (key) {
    case "title":
      return vi ? "Tên khóa học" : "Title";
    case "provider":
      return vi ? "Nền tảng" : "Provider";
    case "priceType":
      return vi ? "Miễn phí thế nào" : "What is free";
    case "certificateType":
      return vi ? "Chứng chỉ" : "Certificate";
    case "level":
      return vi ? "Trình độ" : "Level";
    case "duration":
      return vi ? "Thời lượng" : "Duration";
    case "language":
      return vi ? "Ngôn ngữ" : "Language";
    case "freeDurability":
      return vi ? "Độ bền miễn phí" : "Free durability";
  }
}

function formatRowValue(
  key: ComparisonRowKey,
  course: ComparableCourse,
  locale: Locale,
): string {
  const unknown = locale === "vi" ? "Chưa rõ" : "Unknown";
  switch (key) {
    case "title":
      return course.title;
    case "provider":
      return course.providerName;
    case "priceType":
      return getPriceTypeLabel(course.priceType, locale).label;
    case "certificateType":
      return getCertificateTypeLabel(course.certificateType, locale);
    case "level":
      return formatLevelLabel(course.level, locale);
    case "duration":
      return formatDuration(course.durationMinutes) ?? unknown;
    case "language":
      return course.language ?? unknown;
    case "freeDurability":
      return freeDurabilityLabel(course.freeDurability ?? "UNKNOWN", locale);
  }
}
