import type { Metadata } from "next";
import Link from "next/link";

import { CourseSection } from "@/components/public/course-section";
import { EmptyState } from "@/components/public/empty-state";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PageShell, PageStack } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCategories } from "@/db/repositories/category-repository";
import {
  listCoursesByCategorySlug,
  listPublishedCoursesWithProvider,
  queryCatalog,
} from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { currentBestPath } from "@/domain/discovery/monthly-collection";
import { rankCourses } from "@/domain/ranking/ranking";
import { withDb } from "@/lib/db-safe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FreeLearn Radar — Free online courses worth your time",
  description:
    "Discover curated free online courses. Clear free status, certificate labels, and verification freshness — then go learn on the original provider.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "FreeLearn Radar",
    description:
      "Curated free courses with transparent free status and verification freshness.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FreeLearn Radar",
    description: "Find high-quality free courses faster.",
  },
};

export default async function HomePage() {
  const bestHref = currentBestPath();

  const [published, categories, providers, freeCert, shortCourses] =
    await Promise.all([
      withDb(
        "home.published",
        (db) => listPublishedCoursesWithProvider(db, 60),
        [],
      ),
      withDb("home.categories", (db) => listCategories(db), []),
      withDb("home.providers", (db) => listProviders(db), []),
      withDb(
        "home.freeCert",
        (db) =>
          queryCatalog(db, {
            certificateType: "FREE_CERTIFICATE",
            sort: "recommended",
            page: 1,
            pageSize: 6,
          }),
        { items: [], total: 0, page: 1, pageSize: 6, totalPages: 1 },
      ),
      withDb(
        "home.short",
        (db) =>
          queryCatalog(db, {
            durationMaxMinutes: 60,
            sort: "shortest",
            page: 1,
            pageSize: 6,
          }),
        { items: [], total: 0, page: 1, pageSize: 6, totalPages: 1 },
      ),
    ]);

  const topicPreview = await Promise.all(
    ["ai", "programming", "cloud"]
      .map(async (slug) => ({
        slug,
        courses: await withDb(
          `home.topic.${slug}`,
          (db) => listCoursesByCategorySlug(db, slug, 1),
          [],
        ),
      })),
  );

  const ranked = rankCourses(published);
  const best = ranked.slice(0, 6);
  const freeThisWeek = ranked
    .filter(
      (course) =>
        course.priceType === "TEMPORARILY_FREE" ||
        course.priceType === "FREE_WITH_COUPON" ||
        course.priceType === "FREE_FULL",
    )
    .slice(0, 6);
  const recentlyVerified = [...published]
    .filter((course) => course.lastVerifiedAt)
    .sort(
      (a, b) =>
        (b.lastVerifiedAt?.getTime() ?? 0) - (a.lastVerifiedAt?.getTime() ?? 0),
    )
    .slice(0, 6);

  return (
    <main className="flex min-h-screen flex-col">
      <SiteHeader />

      <section className="border-b border-border/60">
        <PageShell className="py-12 sm:py-16">
          <div className="max-w-2xl space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Free courses · curated · verified
            </p>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              FreeLearn Radar
            </h1>
            <p className="text-lg text-muted-foreground text-pretty">
              Find free online courses from trusted providers — with clear free
              status and verification freshness, not coupon spam.
            </p>
            <form
              action="/search"
              method="get"
              className="flex w-full flex-col gap-3 sm:flex-row"
              role="search"
            >
              <label className="sr-only" htmlFor="home-search">
                What do you want to learn?
              </label>
              <Input
                id="home-search"
                name="q"
                placeholder="What do you want to learn?"
                className="h-11 flex-1 rounded-lg bg-background/90 text-base shadow-sm"
              />
              <Button type="submit" size="lg" className="h-11 rounded-lg">
                Search free courses
              </Button>
            </form>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/free-courses/python">Python</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/free-courses/ai">AI</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/free-certificate-courses">Free certificates</Link>
              </Button>
            </div>
          </div>
        </PageShell>
      </section>

      <PageShell>
        <PageStack>
          {published.length === 0 ? (
            <EmptyState
              title="Catalog not ready yet"
              description="Run migrations and seed to load curated courses, then refresh this page."
              actionHref="/admin"
              actionLabel="Open admin"
            />
          ) : null}

          {freeThisWeek.length > 0 ? (
            <CourseSection
              title="Free this week"
              subtitle="Fully free, limited-time, or coupon-ready picks"
              courses={freeThisWeek}
              viewAllHref="/search?price=TEMPORARILY_FREE"
            />
          ) : null}

          {best.length > 0 ? (
            <CourseSection
              title="Best free courses"
              subtitle="Ranked by quality, freshness, trust, and free value"
              courses={best}
              viewAllHref="/search?sort=recommended"
            />
          ) : null}

          {categories.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">
                Browse by topic
              </h2>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/category/${category.slug}`}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:border-primary/40 hover:bg-accent"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
              {topicPreview.some((t) => t.courses.length > 0) ? (
                <p className="text-sm text-muted-foreground">
                  Popular landings:{" "}
                  {topicPreview
                    .filter((t) => t.courses.length > 0)
                    .map((t, i) => (
                      <span key={t.slug}>
                        {i > 0 ? " · " : null}
                        <Link
                          href={`/free-courses/${t.slug}`}
                          className="text-primary hover:underline capitalize"
                        >
                          {t.slug.replace(/-/g, " ")}
                        </Link>
                      </span>
                    ))}
                </p>
              ) : null}
            </section>
          ) : null}

          {recentlyVerified.length > 0 ? (
            <CourseSection
              title="Recently verified"
              subtitle="Free status checked more recently"
              courses={recentlyVerified}
              viewAllHref="/search?sort=newest"
            />
          ) : null}

          {freeCert.items.length > 0 ? (
            <CourseSection
              title="Free certificate courses"
              subtitle="Only courses with a free certificate — never guessed"
              courses={freeCert.items}
              viewAllHref="/free-certificate-courses"
            />
          ) : null}

          {shortCourses.items.length > 0 ? (
            <CourseSection
              title="Short courses"
              subtitle="About an hour or less"
              courses={shortCourses.items}
              viewAllHref="/collections/under-1-hour"
            />
          ) : null}

          {providers.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">
                Providers
              </h2>
              <div className="flex flex-wrap gap-2">
                {providers.slice(0, 8).map((provider) => (
                  <Link
                    key={provider.id}
                    href={`/provider/${provider.slug}`}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
                  >
                    {provider.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-border bg-card/70 p-6">
            <h2 className="text-xl font-semibold tracking-tight">
              Monthly collection
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A ranked shortlist for the current month.
            </p>
            <Button asChild className="mt-4">
              <Link href={bestHref}>Open this month&apos;s best</Link>
            </Button>
          </section>
        </PageStack>
      </PageShell>

      <SiteFooter />
    </main>
  );
}
