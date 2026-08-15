import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/public/breadcrumb";
import { CourseGrid } from "@/components/public/course-grid";
import { EmptyState } from "@/components/public/empty-state";
import { AffiliateResources } from "@/components/public/affiliate-resources";
import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
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

  const affiliateCards = await withDb(
    "topic.affiliate",
    async (db) => {
      const {
        resolveAffiliatePlacements,
        resolveCommerceProducts,
        PLACEMENT_KEYS,
      } = await import(
        "@/domain/affiliate/resolve-placements"
      );
      const input = {
        placementKey: PLACEMENT_KEYS.TOPIC_LEARNING_RESOURCES,
        locale,
        topicSlug: tag.slug,
        limit: 3,
      };
      const [learning, commerce] = await Promise.all([
        resolveAffiliatePlacements(db, input),
        resolveCommerceProducts(db, input),
      ]);
      return [...learning, ...commerce].slice(0, 6);
    },
    [],
  );

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <PageShell>
        <div className="space-y-6 py-8">
          <Breadcrumb
            label={dict.a11y.breadcrumb}
            items={[
              { label: dict.common.home, href: "/" },
              { label: name },
            ]}
          />

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
            <CourseGrid
              courses={courseItems}
              locale={locale}
              priorityCount={4}
            />
          )}

          <AffiliateResources
            heading={
              locale === "vi"
                ? "Tài nguyên học thêm (tiếp thị)"
                : "Learning resources (affiliate)"
            }
            cards={affiliateCards}
          />
        </div>
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
