import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CourseCard } from "@/components/public/course-card";
import { EmptyState } from "@/components/public/empty-state";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { LocalizedLink } from "@/components/public/localized-link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  canRenderTopicPage,
  findTopicTagBySlug,
  isTopicPageIndexable,
  listPublishedCoursesForTopicTag,
} from "@/domain/taxonomy/topic-tags";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocaleParam } from "@/lib/i18n/page";
import { localePath } from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";

type TopicPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function topicFeatureEnabled(): boolean {
  try {
    return getServerEnv().FEATURE_TOPIC_PAGES === "true";
  } catch {
    return process.env.FEATURE_TOPIC_PAGES === "true";
  }
}

export async function generateMetadata({
  params,
}: TopicPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const { slug } = await params;
  const tag = await withDb(
    "topic.metadata",
    (db) => findTopicTagBySlug(db, slug),
    null,
  );

  if (!tag || !tag.active) {
    return {
      title: dict.meta.topicNotFound,
      robots: { index: false, follow: false },
    };
  }

  const featureOn = topicFeatureEnabled();
  if (!canRenderTopicPage(featureOn, tag.courseCount)) {
    return {
      title: dict.meta.topicNotFound,
      robots: { index: false, follow: false },
    };
  }

  const name = locale === "vi" ? tag.nameVi : tag.nameEn;
  const path = localePath(locale, `/topic/${tag.slug}`);

  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || appUrl;
  }

  return {
    title: `${name} | FreeLearn Radar`,
    description: dict.pages.topicTagIntro(name),
    alternates: buildLocaleAlternates(appUrl, locale, `/topic/${tag.slug}`),
    robots: isTopicPageIndexable(tag.courseCount)
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title: name,
      description: dict.pages.topicTagIntro(name),
      url: path,
      type: "website",
    },
  };
}

export default async function TopicTagPage({ params }: TopicPageProps) {
  const locale = await resolveLocaleParam(params);
  const dict = getDictionary(locale);
  const { slug } = await params;
  const featureOn = topicFeatureEnabled();

  const tag = await withDb(
    "topic.detail",
    (db) => findTopicTagBySlug(db, slug),
    null,
  );

  if (
    !tag ||
    !tag.active ||
    !canRenderTopicPage(featureOn, tag.courseCount)
  ) {
    notFound();
  }

  const rows = await withDb(
    "topic.courses",
    (db) => listPublishedCoursesForTopicTag(db, tag.id),
    [],
  );

  const courseItems = rows.map((row) => ({
    ...row.course,
    provider: row.provider,
  }));

  const name = locale === "vi" ? tag.nameVi : tag.nameEn;

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <PageShell>
        <div className="space-y-6 py-8">
          <nav className="text-sm text-muted-foreground">
            <LocalizedLink href="/" className="hover:underline">
              {dict.common.home}
            </LocalizedLink>
            <span aria-hidden="true" className="mx-1.5">
              /
            </span>
            <span>{name}</span>
          </nav>

          <header className="space-y-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {name}
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              {dict.pages.topicTagIntro(name)}
            </p>
            <p className="text-sm text-muted-foreground">
              {dict.common.courseCount(tag.courseCount)}
            </p>
          </header>

          {courseItems.length === 0 ? (
            <EmptyState
              title={dict.pages.topicEmptyTitle}
              description={dict.pages.topicEmptyDescription}
              actionHref="/search"
              actionLabel={dict.common.searchCatalog}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courseItems.map((course) => (
                <li key={course.id}>
                  <CourseCard course={course} locale={locale} />
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
