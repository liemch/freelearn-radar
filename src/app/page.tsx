import Link from "next/link";

import { CourseSection } from "@/components/public/course-section";
import { EmptyState } from "@/components/public/empty-state";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { Button } from "@/components/ui/button";
import { listCategories } from "@/db/repositories/category-repository";
import {
  listCoursesByCategorySlug,
  listPublishedCoursesWithProvider,
} from "@/db/repositories/course-repository";
import { rankCourses } from "@/domain/ranking/ranking";
import { withDb } from "@/lib/db-safe";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [published, ai, programming, cloud, cybersecurity, data, categories] =
    await Promise.all([
      withDb("home.published", (db) => listPublishedCoursesWithProvider(db, 40), []),
      withDb("home.ai", (db) => listCoursesByCategorySlug(db, "ai", 3), []),
      withDb(
        "home.programming",
        (db) => listCoursesByCategorySlug(db, "programming", 3),
        [],
      ),
      withDb("home.cloud", (db) => listCoursesByCategorySlug(db, "cloud", 3), []),
      withDb(
        "home.cybersecurity",
        (db) => listCoursesByCategorySlug(db, "cybersecurity", 3),
        [],
      ),
      withDb(
        "home.data",
        (db) => listCoursesByCategorySlug(db, "data-science", 3),
        [],
      ),
      withDb("home.categories", (db) => listCategories(db), []),
    ]);

  const ranked = rankCourses(published);
  const recent = [...published]
    .sort((a, b) => {
      const aTime = a.publishedAt?.getTime() ?? 0;
      const bTime = b.publishedAt?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 6);
  const best = ranked.slice(0, 6);
  const freeThisWeek = ranked
    .filter(
      (course) =>
        course.priceType === "TEMPORARILY_FREE" ||
        course.priceType === "FREE_WITH_COUPON" ||
        course.priceType === "FREE_FULL",
    )
    .slice(0, 6);

  return (
    <main className="flex min-h-screen flex-col">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,oklch(0.85_0.08_175/0.35),transparent_45%),radial-gradient(circle_at_80%_0%,oklch(0.9_0.06_90/0.3),transparent_40%)]" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-3xl space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Learn more. Spend $0.
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              FreeLearn Radar
            </h1>
            <p className="text-lg text-muted-foreground sm:text-xl">
              Discover free online courses worth your time — curated from top
              platforms, with free status first and AI summaries second.
            </p>
            <form
              action="/search"
              method="get"
              className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
              role="search"
            >
              <label className="sr-only" htmlFor="home-search">
                What do you want to learn?
              </label>
              <input
                id="home-search"
                name="q"
                placeholder="What do you want to learn?"
                className="border-input bg-background/90 flex h-11 w-full rounded-xl border px-4 text-sm shadow-sm"
              />
              <Button type="submit" size="lg" className="rounded-xl">
                Explore free courses
              </Button>
            </form>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/search?price=TEMPORARILY_FREE">Free this week</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/category/ai">Browse AI</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 py-12 sm:px-6">
        {recent.length === 0 ? (
          <EmptyState
            title="Catalog not ready yet"
            description="Run migrations and seed to load curated mock courses, then refresh this page."
            actionHref="/admin"
            actionLabel="Open admin"
          />
        ) : null}

        <CourseSection
          title="Free This Week"
          subtitle="Fully free, temporarily free, or coupon-ready picks"
          courses={freeThisWeek}
          viewAllHref="/search?price=TEMPORARILY_FREE"
        />

        <CourseSection
          title="Best Free Courses"
          subtitle="Ranked by quality, freshness, free value, and editorial signals"
          courses={best}
          viewAllHref="/search?sort=recommended"
        />

        <CourseSection
          title="Recently Added"
          subtitle="Newest published courses"
          courses={recent}
          viewAllHref="/search?sort=newest"
        />

        <CourseSection title="AI" courses={ai} viewAllHref="/category/ai" />
        <CourseSection
          title="Programming"
          courses={programming}
          viewAllHref="/category/programming"
        />
        <CourseSection title="Cloud" courses={cloud} viewAllHref="/category/cloud" />
        <CourseSection
          title="Cybersecurity"
          courses={cybersecurity}
          viewAllHref="/category/cybersecurity"
        />
        <CourseSection
          title="Data"
          courses={data}
          viewAllHref="/category/data-science"
        />

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Browse categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-medium transition hover:border-primary/40 hover:bg-accent"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
