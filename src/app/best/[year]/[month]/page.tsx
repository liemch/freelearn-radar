import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseCard } from "@/components/public/course-card";
import { EmptyState } from "@/components/public/empty-state";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { listPublishedCoursesWithProvider } from "@/db/repositories/course-repository";
import { rankCourses } from "@/domain/ranking/ranking";
import { withDb } from "@/lib/db-safe";

type BestPageProps = {
  params: Promise<{ year: string; month: string }>;
};

export async function generateMetadata({
  params,
}: BestPageProps): Promise<Metadata> {
  const { year, month } = await params;
  const monthNumber = Number(month);
  const title = `Best Free Online Courses — ${monthName(monthNumber)} ${year}`;

  return {
    title: `${title} | FreeLearn Radar`,
    description: `Curated best free online courses for ${monthName(monthNumber)} ${year}.`,
    alternates: { canonical: `/best/${year}/${month}` },
    openGraph: {
      title,
      description: `Top free courses curated for ${monthName(monthNumber)} ${year}.`,
      url: `/best/${year}/${month}`,
      type: "website",
    },
  };
}

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

export default async function BestCoursesPage({ params }: BestPageProps) {
  const { year, month } = await params;
  const yearNumber = Number(year);
  const monthNumber = Number(month);

  if (
    !Number.isInteger(yearNumber) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    notFound();
  }

  const published = await withDb(
    "best.list",
    (db) => listPublishedCoursesWithProvider(db, 100),
    [],
  );

  const start = new Date(Date.UTC(yearNumber, monthNumber - 1, 1));
  const end = new Date(Date.UTC(yearNumber, monthNumber, 1));

  const inMonth = published.filter((course) => {
    if (!course.publishedAt) return false;
    const ts = course.publishedAt.getTime();
    return ts >= start.getTime() && ts < end.getTime();
  });

  const ranked = rankCourses(inMonth.length > 0 ? inMonth : published).slice(
    0,
    20,
  );

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Best Free Online Courses — {monthName(monthNumber)} {year}
          </h1>
          <p className="text-muted-foreground">
            Ranked by quality, freshness, free value, and editorial signals.
          </p>
          <p className="text-sm text-muted-foreground">
            {inMonth.length > 0
              ? `${inMonth.length} courses published this month`
              : "No courses published this month yet — showing overall top ranked courses."}
          </p>
        </div>

        {ranked.length === 0 ? (
          <EmptyState
            title="No ranked courses yet"
            description="Publish free courses to populate this monthly ranking."
            actionHref="/search"
            actionLabel="Browse catalog"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Browse all courses on{" "}
          <Link href="/search" className="text-primary hover:underline">
            Search
          </Link>
          .
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
