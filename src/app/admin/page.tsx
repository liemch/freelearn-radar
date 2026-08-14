import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { HealthPanel } from "@/components/admin/health-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { countCandidatesByStatus } from "@/db/repositories/candidate-repository";
import {
  countCoursesByStatus,
  countPublishedCoursesByCertificate,
} from "@/db/repositories/course-repository";
import { listCategories } from "@/db/repositories/category-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { getDb } from "@/db";
import {
  getOperationsSnapshot,
  listRecentActivity,
} from "@/domain/admin/operations-snapshot";
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

  let workItems: Array<{ label: string; value: number; href: string }> = [];
  let stats: Array<{ label: string; value: number; href: string }> = [];
  let snapshot: Awaited<ReturnType<typeof getOperationsSnapshot>> | null = null;
  let activity: Awaited<ReturnType<typeof listRecentActivity>> = [];
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
      operations,
      recentActivity,
    ] = await Promise.all([
      countCandidatesByStatus(db, "READY_FOR_REVIEW"),
      countCoursesByStatus(db, "PUBLISHED"),
      countCoursesByStatus(db, "DRAFT"),
      listProviders(db, false),
      listCategories(db),
      countCandidatesByStatus(db, "ERROR"),
      countPublishedCoursesByCertificate(db, "UNKNOWN"),
      getOperationsSnapshot(db),
      listRecentActivity(db, 8),
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
        href: "/admin/taxonomy",
      },
    ];

    snapshot = operations;
    activity = recentActivity;
  } catch {
    databaseReady = false;
  }

  const outstanding = workItems.filter((item) => item.value > 0);

  return (
    <>
      <AdminPageHeader
        title={t.common.adminDashboard}
        description={t.dashboard.workListDescription}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/">{t.common.viewPublicSite}</Link>
          </Button>
        }
      />

      {!databaseReady ? (
        <section className="mb-6 rounded-xl border border-dashed border-border bg-card p-6">
          <h2 className="text-base font-semibold">
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

      <div className="space-y-6">
        {/*
          Incidents first and visually separate from ordinary counts: a queue of
          three candidates and a catalogue of forty published courses are
          different kinds of number, and mixing them trains operators to skim
          past both.
        */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">
              {t.dashboard.actionRequired}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t.dashboard.actionRequiredDescription}
            </p>
          </div>

          {outstanding.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success-surface px-4 py-3">
              <CheckCircle2
                className="size-4 shrink-0 text-success"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-success-foreground">
                  {t.dashboard.allClear}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.dashboard.allClearDescription}
                </p>
              </div>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {outstanding.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex h-full items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-surface px-4 py-3 transition hover:border-warning/60"
                  >
                    <span className="min-w-0">
                      <span className="block text-2xl font-semibold leading-tight text-warning-foreground">
                        {item.value}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {item.label}
                      </span>
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-warning-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">
                {t.dashboard.catalogOverview}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t.dashboard.catalogOverviewDescription}
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stats.map((stat) => (
                <li key={stat.label}>
                  <Link
                    href={stat.href}
                    className="block h-full rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/40"
                  >
                    <span className="block text-2xl font-semibold leading-tight">
                      {stat.value}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {stat.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="pt-2">
              <h2 className="text-sm font-semibold">
                {t.dashboard.quickActions}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/admin/discovery">{t.discovery.runDiscovery}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/courses/new">{t.nav.newCourse}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/candidates">{t.nav.candidates}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/providers">{t.nav.providers}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/analytics">{t.nav.analytics}</Link>
                </Button>
              </div>
            </div>
          </section>

          <div className="space-y-6">
            {snapshot ? (
              <HealthPanel
                t={t}
                locale={locale}
                items={[
                  { label: t.health.discovery, health: snapshot.discovery },
                  {
                    label: t.health.verification,
                    health: snapshot.verification,
                  },
                  { label: t.health.monitor, health: snapshot.monitor },
                ]}
              />
            ) : null}

            <section className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">
                    {t.dashboard.recentActivity}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.dashboard.recentActivityDescription}
                  </p>
                </div>
              </div>

              {activity.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  {t.dashboard.noActivity}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {activity.map((entry) => (
                    <li key={entry.id} className="px-4 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-medium">
                          {entry.action}
                        </p>
                        <Badge variant="outline">{entry.actorType}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {entry.entityType} ·{" "}
                        {entry.createdAt.toLocaleString(
                          locale === "vi" ? "vi-VN" : "en-GB",
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
