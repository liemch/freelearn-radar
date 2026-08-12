import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseCard } from "@/components/public/course-card";
import { EmptyState } from "@/components/public/empty-state";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import { listPublishedCoursesWithProvider } from "@/db/repositories/course-repository";
import { selectMonthlyCollection } from "@/domain/discovery/monthly-collection";
import { buildItemListJsonLd } from "@/domain/seo/json-ld";
import { withDb } from "@/lib/db-safe";
import { getServerEnv } from "@/lib/env";

type BestPageProps = {
  params: Promise<{ year: string; month: string }>;
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
  const { year, month } = await params;
  const monthNumber = Number(month);
  const title = `Best Free Online Courses — ${monthName(monthNumber)} ${year}`;

  return {
    title: `${title} | FreeLearn Radar`,
    description: `Curated best free online courses for ${monthName(monthNumber)} ${year}, ranked by quality, trust, and freshness.`,
    alternates: { canonical: `/best/${year}/${month}` },
    openGraph: {
      title,
      description: `Top free courses curated for ${monthName(monthNumber)} ${year}.`,
      url: `/best/${year}/${month}`,
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

  const title = `Best Free Online Courses — ${monthName(monthNumber)} ${year}`;

  return (
    <main className="min-h-screen bg-background">
      <JsonLd
        data={buildItemListJsonLd({
          name: title,
          description: `Monthly free course collection for ${monthName(monthNumber)} ${year}.`,
          url: `${appUrl}/best/${year}/${month}`,
          courses: collection.items,
          appUrl,
        })}
      />
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="text-muted-foreground">
            Ranked by quality, freshness, trust, free value, and editorial
            signals — not publish date alone.
          </p>
          <p className="text-sm text-muted-foreground">
            {collection.mode === "in_month"
              ? `${collection.inMonthCount} courses published this month · showing top ${collection.items.length}`
              : "No courses published this month yet — showing overall top ranked courses."}
          </p>
        </div>

        {collection.items.length === 0 ? (
          <EmptyState
            title="No ranked courses yet"
            description="Publish free courses to populate this monthly ranking."
            actionHref="/search"
            actionLabel="Browse catalog"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collection.items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Browse{" "}
          <Link href="/search" className="text-primary hover:underline">
            Search
          </Link>{" "}
          or{" "}
          <Link
            href="/free-certificate-courses"
            className="text-primary hover:underline"
          >
            free certificate courses
          </Link>
          .
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
