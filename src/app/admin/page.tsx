import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/logout-button";
import { Button } from "@/components/ui/button";
import { countCandidatesByStatus } from "@/db/repositories/candidate-repository";
import { countCoursesByStatus } from "@/db/repositories/course-repository";
import { listCategories } from "@/db/repositories/category-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { getDb } from "@/db";
import { getSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/admin/login");
  }

  const db = getDb();

  let stats = [
    { label: "Pending Review", value: 0 },
    { label: "Published Courses", value: 0 },
    { label: "Draft Courses", value: 0 },
    { label: "Providers", value: 0 },
    { label: "Categories", value: 0 },
    { label: "Discovery Errors", value: 0 },
  ];
  let databaseReady = true;

  try {
    const [
      pendingReview,
      publishedCourses,
      draftCourses,
      providers,
      categories,
      discoveryErrors,
    ] = await Promise.all([
      countCandidatesByStatus(db, "READY_FOR_REVIEW"),
      countCoursesByStatus(db, "PUBLISHED"),
      countCoursesByStatus(db, "DRAFT"),
      listProviders(db, false),
      listCategories(db),
      countCandidatesByStatus(db, "ERROR"),
    ]);

    stats = [
      { label: "Pending Review", value: pendingReview },
      { label: "Published Courses", value: publishedCourses },
      { label: "Draft Courses", value: draftCourses },
      { label: "Providers", value: providers.length },
      { label: "Categories", value: categories.length },
      { label: "Discovery Errors", value: discoveryErrors },
    ];
  } catch {
    databaseReady = false;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
            <h1 className="text-xl font-semibold">FreeLearn Radar</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
              {session.role}
            </span>
            <span className="text-sm text-muted-foreground">{session.email}</span>
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
            </article>
          ))}
        </div>

        {!databaseReady ? (
          <section className="mt-8 rounded-xl border border-dashed border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Database not ready</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Run migrations and seed data before using admin stats:
              {" "}
              <code className="rounded bg-muted px-1 py-0.5">npm run db:migrate:run</code>
              {" "}
              then
              {" "}
              <code className="rounded bg-muted px-1 py-0.5">npm run db:seed</code>.
            </p>
          </section>
        ) : null}

        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Operations</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage catalog manually, review discovery candidates, and inspect
            outbound click analytics.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/admin/courses">Manage courses</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/courses/new">New course</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/candidates">Candidates</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/discovery">Discovery</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/analytics">Analytics</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">View public site</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
