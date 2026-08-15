import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminMetric, AdminMetricRow } from "@/components/admin/admin-metric";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import {
  AdminTable,
  AdminTd,
  AdminTh,
  AdminTr,
} from "@/components/admin/admin-table";
import { LatestRunPanel } from "@/components/admin/latest-run-panel";
import {
  ServiceHealthPanel,
  type ServiceHealthRow,
} from "@/components/admin/service-health-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  countCandidatesByStatus,
} from "@/db/repositories/candidate-repository";
import {
  countCoursesByStatus,
  countPublishedCoursesByCertificate,
  listCourses,
} from "@/db/repositories/course-repository";
import { listCategories } from "@/db/repositories/category-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { getDb } from "@/db";
import {
  getOperationsSnapshot,
  listRecentActivity,
  type HealthState,
  type OperationsSnapshot,
  type SubsystemHealth,
} from "@/domain/admin/operations-snapshot";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import type { AdminDictionary } from "@/lib/i18n/admin/types";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

function stateLabel(state: HealthState, t: AdminDictionary): string {
  if (state === "healthy") return t.health.healthy;
  if (state === "degraded") return t.health.degraded;
  if (state === "failed") return t.health.failed;
  return t.health.unknown;
}

function signalDetail(
  health: SubsystemHealth,
  t: AdminDictionary,
  locale: string,
): string {
  if (!health.observedAt) return t.health.unknownHint;
  return `${t.health.lastSignal}: ${health.observedAt.toLocaleString(
    locale === "vi" ? "vi-VN" : "en-GB",
  )}`;
}

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
  let snapshot: OperationsSnapshot | null = null;
  let activity: Awaited<ReturnType<typeof listRecentActivity>> = [];
  let databaseReady = true;

  try {
    const [
      pendingReview,
      publishedCourses,
      draftCourses,
      archivedCourses,
      providers,
      categories,
      discoveryErrors,
      unknownCertificate,
      missingImageRows,
      brokenImageRows,
      operations,
      recentActivity,
    ] = await Promise.all([
      countCandidatesByStatus(db, "READY_FOR_REVIEW"),
      countCoursesByStatus(db, "PUBLISHED"),
      countCoursesByStatus(db, "DRAFT"),
      countCoursesByStatus(db, "ARCHIVED"),
      listProviders(db, false),
      listCategories(db),
      countCandidatesByStatus(db, "ERROR"),
      countPublishedCoursesByCertificate(db, "UNKNOWN"),
      listCourses(db, { imageStatus: "MISSING", limit: 500 }),
      listCourses(db, { imageStatus: "BROKEN", limit: 500 }),
      getOperationsSnapshot(db, { runHistoryLimit: 1 }),
      listRecentActivity(db, 8),
    ]);

    const missingImages = missingImageRows.length;
    const brokenImages = brokenImageRows.length;

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
      {
        label: t.dashboard.stats.missingImages,
        value: missingImages,
        href: "/admin/courses?imageStatus=MISSING",
      },
      {
        label: t.dashboard.stats.brokenImages,
        value: brokenImages,
        href: "/admin/courses?imageStatus=BROKEN",
      },
      {
        label: t.dashboard.stats.archivedCourses,
        value: archivedCourses,
        href: "/admin/courses?status=ARCHIVED",
      },
    ];

    stats = [
      {
        label: t.dashboard.stats.publishedCourses,
        value: publishedCourses,
        href: "/admin/courses?status=PUBLISHED",
      },
      {
        label: t.dashboard.stats.draftCourses,
        value: draftCourses,
        href: "/admin/courses?status=DRAFT",
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

  const serviceRows: ServiceHealthRow[] = snapshot
    ? [
        {
          key: "collector",
          label: t.health.collector,
          state: snapshot.discovery.state,
          stateLabel: stateLabel(snapshot.discovery.state, t),
          detail: signalDetail(snapshot.discovery, t, locale),
        },
        {
          key: "verification",
          label: t.health.verification,
          state: snapshot.verification.state,
          stateLabel: stateLabel(snapshot.verification.state, t),
          detail: signalDetail(snapshot.verification, t, locale),
        },
        {
          key: "cron",
          label: t.health.cronJob,
          state: snapshot.monitor.state,
          stateLabel: stateLabel(snapshot.monitor.state, t),
          detail: signalDetail(snapshot.monitor, t, locale),
        },
        {
          key: "search",
          label: t.health.searchProvider,
          state: "unknown",
          stateLabel: t.health.unknown,
          detail: t.health.noRecordedSignal,
        },
      ]
    : [];

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
        <AdminPanel title={t.dashboard.databaseNotReady} className="mb-4">
          <p className="text-[0.8125rem] text-muted-foreground">
            {t.dashboard.databaseNotReadyDescription}{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              npm run db:migrate:run
            </code>{" "}
            {t.common.then}{" "}
            <code className="rounded bg-muted px-1 py-0.5">npm run db:seed</code>
            .
          </p>
        </AdminPanel>
      ) : null}

      <div className="space-y-4">
        {/*
          Incidents sit apart from ordinary counts. A queue of three candidates
          and a catalogue of forty courses are different kinds of number, and
          mixing them teaches operators to skim past both.
        */}
        <section className="space-y-2">
          <h2 className="text-[0.8125rem] font-semibold">
            {t.dashboard.actionRequired}
          </h2>

          {outstanding.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-success/25 bg-success-surface px-3.5 py-2.5">
              <CheckCircle2
                className="size-4 shrink-0 text-success"
                aria-hidden="true"
              />
              <p className="text-[0.8125rem] font-medium text-success-foreground">
                {t.dashboard.allClear}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {t.dashboard.allClearDescription}
                </span>
              </p>
            </div>
          ) : (
            <AdminMetricRow>
              {outstanding.map((item) => (
                <AdminMetric
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  href={item.href}
                  tone="attention"
                />
              ))}
            </AdminMetricRow>
          )}
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <section className="space-y-2">
              <h2 className="text-[0.8125rem] font-semibold">
                {t.dashboard.catalogOverview}
              </h2>
              <AdminMetricRow>
                {stats.map((stat) => (
                  <AdminMetric
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    href={stat.href}
                  />
                ))}
              </AdminMetricRow>
            </section>

            <AdminPanel
              title={t.dashboard.recentActivity}
              description={t.dashboard.recentActivityDescription}
              flush
            >
              {activity.length === 0 ? (
                <AdminEmptyState message={t.dashboard.noActivity} />
              ) : (
                <AdminTable caption={t.dashboard.recentActivity}>
                  <thead>
                    <tr>
                      <AdminTh>{t.discovery.runTime}</AdminTh>
                      <AdminTh>{t.common.actions}</AdminTh>
                      <AdminTh>{t.common.status}</AdminTh>
                      <AdminTh>{t.discovery.runActor}</AdminTh>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((entry) => (
                      <AdminTr key={entry.id}>
                        <AdminTd className="whitespace-nowrap text-muted-foreground">
                          {entry.createdAt.toLocaleString(
                            locale === "vi" ? "vi-VN" : "en-GB",
                          )}
                        </AdminTd>
                        <AdminTd className="font-medium">
                          {entry.action}
                        </AdminTd>
                        <AdminTd className="text-muted-foreground">
                          {entry.entityType}
                        </AdminTd>
                        <AdminTd className="whitespace-nowrap">
                          <Badge variant="outline">{entry.actorType}</Badge>
                        </AdminTd>
                      </AdminTr>
                    ))}
                  </tbody>
                </AdminTable>
              )}
            </AdminPanel>

            <section className="space-y-2">
              <h2 className="text-[0.8125rem] font-semibold">
                {t.dashboard.quickActions}
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/admin/discovery">
                    {t.discovery.runDiscovery}
                  </Link>
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
            </section>
          </div>

          <div className="space-y-4">
            {snapshot ? (
              <>
                <ServiceHealthPanel
                  rows={serviceRows}
                  labels={{
                    heading: t.health.heading,
                    description: t.health.description,
                    healthy: t.health.healthy,
                    failed: t.health.failed,
                    unknown: t.health.unknown,
                    aiLabel: t.health.aiEnrichment,
              recheck: t.health.recheck,
                    checking: t.health.checking,
                    notChecked: t.health.notChecked,
                    checkFailed: t.discovery.aiCheckRequestFailed,
                  }}
                />
                <LatestRunPanel
                  t={t}
                  locale={locale}
                  run={snapshot.latestRun}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
