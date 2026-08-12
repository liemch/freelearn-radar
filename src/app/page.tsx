import Link from "next/link";

import { CourseSection } from "@/components/public/course-section";
import { SiteHeader } from "@/components/public/site-header";
import { Button } from "@/components/ui/button";
import { listCategories } from "@/db/repositories/category-repository";
import {
  listBestCourses,
  listCoursesByCategorySlug,
  listPublishedCoursesWithProvider,
} from "@/db/repositories/course-repository";
import { withDb } from "@/lib/db-safe";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [recent, best, ai, programming, cloud, cybersecurity, data, categories] =
    await Promise.all([
      withDb("home.recent", (db) => listPublishedCoursesWithProvider(db, 6), []),
      withDb("home.best", (db) => listBestCourses(db, 6), []),
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

  const freeThisWeek = recent.filter(
    (course) =>
      course.priceType === "TEMPORARILY_FREE" ||
      course.priceType === "FREE_WITH_COUPON" ||
      course.priceType === "FREE_FULL",
  );

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_45%),linear-gradient(180deg,_rgba(255,255,255,0.9),_rgba(248,250,252,1))]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
          <div className="max-w-3xl space-y-5">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">
              Learn more. Spend $0.
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Discover free online courses worth your time
            </h1>
            <p className="text-lg text-muted-foreground">
              Discover the best free online courses from top learning platforms —
              curated and verified in one place.
            </p>
            <form
              action="/search"
              method="get"
              className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
            >
              <input
                name="q"
                placeholder="What do you want to learn?"
                className="border-input bg-background flex h-11 w-full rounded-md border px-4 text-sm shadow-sm"
              />
              <Button type="submit" size="lg">
                Explore Free Courses
              </Button>
            </form>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/search?price=TEMPORARILY_FREE">Free This Week</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/category/ai">Browse AI</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 py-12">
        {recent.length === 0 ? (
          <section className="rounded-xl border border-dashed border-border p-8 text-center">
            <h2 className="text-xl font-semibold">Catalog not ready yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Run migrations and seed to load mock courses:
              {" "}
              <code className="rounded bg-muted px-1 py-0.5">npm run db:migrate:run</code>
              {" "}
              then
              {" "}
              <code className="rounded bg-muted px-1 py-0.5">npm run db:seed</code>.
            </p>
          </section>
        ) : null}

        <CourseSection
          title="Free This Week"
          subtitle="Fully free, temporarily free, or coupon-ready picks"
          courses={freeThisWeek.slice(0, 6)}
          viewAllHref="/search?price=TEMPORARILY_FREE"
        />

        <CourseSection
          title="Best Free Courses"
          subtitle="Highest quality scores from curated inventory"
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
          <h2 className="text-2xl font-semibold tracking-tight">Browse Categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t border-border/60 py-6 text-center text-sm text-muted-foreground">
        FreeLearn Radar — curated free course discovery
      </footer>
    </main>
  );
}
