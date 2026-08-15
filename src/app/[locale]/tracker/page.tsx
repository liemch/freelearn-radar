import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { LocalizedLink } from "@/components/public/localized-link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PageShell } from "@/components/layout/page-shell";
import { listRecentPublic } from "@/db/repositories/price-event-repository";
import { findCourseById } from "@/db/repositories/course-repository";
import { priceEventLabel } from "@/domain/tracker/vocabulary";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";

/**
 * The feature gate has to be evaluated per request — see the note on the
 * learning-path page. A prerendered gate is a redeploy, not a kill switch. This
 * page also renders live price events, which should never be served from a
 * build-time snapshot.
 */
export const dynamic = "force-dynamic";

type TrackerPageProps = {
  params: Promise<{ locale: string }>;
};

function trackerEnabled(): boolean {
  try {
    return getServerEnv().FEATURE_TRACKER_UI === "true";
  } catch {
    return process.env.FEATURE_TRACKER_UI === "true";
  }
}

export async function generateMetadata({
  params,
}: TrackerPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);

  if (!trackerEnabled()) {
    return {
      title: dict.meta.trackerNotFound,
      robots: { index: false, follow: false },
    };
  }

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  return {
    title: `${dict.tracker.heading} | FreeLearn Radar`,
    description: dict.tracker.description,
    alternates: buildLocaleAlternates(appUrl, locale, "/tracker"),
    robots: { index: true, follow: true },
  };
}

export default async function TrackerPage({ params }: TrackerPageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);

  if (!trackerEnabled()) {
    notFound();
  }

  const events = await withDb(
    "tracker.events",
    (db) => listRecentPublic(db, { limit: 40 }),
    [],
  );

  const enriched = await withDb(
    "tracker.courses",
    async (db) => {
      const items = [];
      for (const event of events) {
        const course = await findCourseById(db, event.courseId);
        items.push({ event, course });
      }
      return items;
    },
    [] as Array<{
      event: (typeof events)[number];
      course: Awaited<ReturnType<typeof findCourseById>>;
    }>,
  );

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <PageShell>
        <div className="space-y-6 py-8">
          <header className="space-y-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {dict.tracker.heading}
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              {dict.tracker.description}
            </p>
          </header>

          {enriched.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <h2 className="text-lg font-semibold">{dict.tracker.emptyTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {dict.tracker.emptyDescription}
              </p>
              <LocalizedLink
                href="/search"
                className="mt-4 inline-block text-sm text-primary hover:underline"
              >
                {dict.common.searchCatalog}
              </LocalizedLink>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {enriched.map(({ event, course }) => (
                <li key={event.id} className="px-4 py-4 sm:px-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {priceEventLabel(event.eventType, locale)}
                  </p>
                  {course ? (
                    <LocalizedLink
                      href={localePath(locale, `/course/${course.slug}`)}
                      className="mt-1 block text-base font-semibold hover:text-primary"
                    >
                      {course.title}
                    </LocalizedLink>
                  ) : (
                    <p className="mt-1 text-base font-semibold">
                      {dict.tracker.unknownCourse}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(event.confirmedAt ?? event.createdAt).toLocaleString(
                      locale,
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
