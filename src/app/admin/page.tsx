import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLanguageSwitcher } from "@/components/admin/admin-language-switcher";
import { AdminLogoutButton } from "@/components/admin/logout-button";
import { Button } from "@/components/ui/button";
import { countCandidatesByStatus } from "@/db/repositories/candidate-repository";
import {
  countCoursesByStatus,
  countPublishedCoursesByCertificate,
} from "@/db/repositories/course-repository";
import { listCategories } from "@/db/repositories/category-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { getDb } from "@/db";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/admin/login");
  }

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const db = getDb();

  let workItems: Array<{ label: string; value: number; href: string }> = [
    {
      label: t.dashboard.stats.discoveryErrors,
      value: 0,
      href: "/admin/candidates?view=error",
    },
    {
      label: t.dashboard.stats.pendingReview,
      value: 0,
      href: "/admin/candidates?view=ready",
    },
    {
      label: t.dashboard.stats.unknownCertificate,
      value: 0,
      href: "/admin/courses?certificate=UNKNOWN",
    },
  ];

  let stats = [
    { label: t.dashboard.stats.publishedCourses, value: 0, href: "/admin/courses" },
    { label: t.dashboard.stats.draftCourses, value: 0, href: "/admin/courses" },
    { label: t.dashboard.stats.providers, value: 0, href: "/admin/providers" },
    { label: t.dashboard.stats.categories, value: 0, href: "/admin" },
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
      unknownCertificate,
    ] = await Promise.all([
      countCandidatesByStatus(db, "READY_FOR_REVIEW"),
      countCoursesByStatus(db, "PUBLISHED"),
      countCoursesByStatus(db, "DRAFT"),
      listProviders(db, false),
      listCategories(db),
      countCandidatesByStatus(db, "ERROR"),
      countPublishedCoursesByCertificate(db, "UNKNOWN"),
    ]);

    workItems = [
      {
        label: t.dashboard.stats.discoveryErrors,
        value: discoveryErrors,
        href: "/admin/candidates?view=error",
      },
      {
        label: t.dashboard.stats.pendingReview,
        value: pendingReview,
        href: "/admin/candidates?view=ready",
      },
      {
        label: t.dashboard.stats.unknownCertificate,
        value: unknownCertificate,
        href: "/admin/courses?certificate=UNKNOWN",
      },
    ];

    stats = [
      {
        label: t.dashboard.stats.publishedCourses,
        value: publishedCourses,
        href: "/admin/courses",
      },
      {
        label: t.dashboard.stats.draftCourses,
        value: draftCourses,
        href: "/admin/courses",
      },
      {
        label: t.dashboard.stats.providers,
        value: providers.length,
        href: "/admin/providers",
      },
      {
        label: t.dashboard.stats.categories,
        value: categories.length,
        href: "/admin",
      },
    ];
  } catch {
    databaseReady = false;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {t.common.adminDashboard}
            </p>
            <h1 className="text-xl font-semibold">FreeLearn Radar</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
              {session.role}
            </span>
            <span className="text-sm text-muted-foreground">{session.email}</span>
            <AdminLanguageSwitcher
              locale={locale}
              label={t.common.language}
            />
            <AdminLogoutButton
              label={t.common.signOut}
              signingOutLabel={t.common.signingOut}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{t.dashboard.workList}</h2>
            <p className="text-sm text-muted-foreground">
              {t.dashboard.workListDescription}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary"
              >
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold">{item.value}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary"
            >
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
            </Link>
          ))}
        </div>

        {!databaseReady ? (
          <section className="mt-8 rounded-xl border border-dashed border-border bg-card p-6">
            <h2 className="text-lg font-semibold">
              {t.dashboard.databaseNotReady}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.dashboard.databaseNotReadyDescription}{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                npm run db:migrate:run
              </code>{" "}
              {t.common.then}{" "}
              <code className="rounded bg-muted px-1 py-0.5">npm run db:seed</code>
              .
            </p>
          </section>
        ) : null}

        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">{t.dashboard.operations}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.dashboard.operationsDescription}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/admin/courses">{t.nav.courses}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/courses/new">{t.nav.newCourse}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/candidates">{t.nav.candidates}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/discovery">{t.nav.discovery}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/providers">{t.nav.providers}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/taxonomy">{t.nav.taxonomy}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/discovery/queries">
                {t.nav.discoveryQueries}
              </Link>
            </Button>
            {session.role === "ADMIN" ? (
              <Button asChild variant="outline">
                <Link href="/admin/users">{t.nav.users}</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/admin/analytics">{t.nav.analytics}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">{t.common.viewPublicSite}</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
