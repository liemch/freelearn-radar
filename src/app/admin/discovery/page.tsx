import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminMetric, AdminMetricRow } from "@/components/admin/admin-metric";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatus } from "@/components/admin/admin-status";
import { DiscoveryRunForm } from "@/components/admin/discovery-run-form";
import { LatestRunPanel } from "@/components/admin/latest-run-panel";
import { RunHistoryTable } from "@/components/admin/run-history-table";
import {
  ServiceHealthPanel,
  type ServiceHealthRow,
} from "@/components/admin/service-health-panel";
import { listDiscoveryQueryFacets } from "@/db/repositories/discovery-query-repository";
import {
  getOperationsSnapshot,
  type HealthState,
  type OperationsSnapshot,
  type SubsystemHealth,
} from "@/domain/admin/operations-snapshot";
import { getSession } from "@/lib/auth/guards";
import { withDb } from "@/lib/db-safe";
import { getAdminDictionary } from "@/lib/i18n/admin";
import type { AdminDictionary } from "@/lib/i18n/admin/types";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

/** Shown when the database is unreachable: everything is genuinely unknown. */
const EMPTY_SNAPSHOT: OperationsSnapshot = {
  discovery: { state: "unknown", observedAt: null },
  verification: { state: "unknown", observedAt: null },
  monitor: { state: "unknown", observedAt: null },
  queries: { total: 0, enabled: 0, dueNow: 0 },
  latestRun: null,
  recentRuns: [],
};

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

export default async function AdminDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const params = await searchParams;
  const initialCategory =
    typeof params.category === "string" ? params.category : "";
  const initialProvider =
    typeof params.provider === "string" ? params.provider : "";

  const [facets, snapshot] = await Promise.all([
    withDb("admin.discovery.facets", (db) => listDiscoveryQueryFacets(db), {
      providers: [],
      categories: [],
    }),
    withDb(
      "admin.discovery.snapshot",
      (db) => getOperationsSnapshot(db, { runHistoryLimit: 12 }),
      EMPTY_SNAPSHOT,
    ),
  ]);

  const latest = snapshot.latestRun;

  /*
   * Search is listed as Unknown, not Healthy. Nothing records a Tavily outcome
   * anywhere, so the only honest state is "no signal" — and saying so is what
   * eventually gets the signal added.
   */
  const serviceRows: ServiceHealthRow[] = [
    {
      key: "collector",
      label: t.health.collector,
      state: snapshot.discovery.state,
      stateLabel: stateLabel(snapshot.discovery.state, t),
      detail: signalDetail(snapshot.discovery, t, locale),
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
  ];

  return (
    <>
      <AdminPageHeader
        title={t.discovery.heading}
        description={t.discovery.description}
        meta={
          <>
            <AdminStatus
              state={snapshot.discovery.state}
              label={`${t.health.collector} · ${stateLabel(
                snapshot.discovery.state,
                t,
              )}`}
            />
            <span className="text-xs text-muted-foreground">
              {latest
                ? `${t.discovery.latestRun}: ${latest.at.toLocaleString(
                    locale === "vi" ? "vi-VN" : "en-GB",
                  )}`
                : t.discovery.latestRunNone}
            </span>
          </>
        }
        actions={
          <Link
            href="/admin/discovery/queries"
            className="text-xs font-medium text-primary hover:underline"
          >
            {t.nav.discoveryQueries}
          </Link>
        }
      />

      <div className="space-y-4">
        {/*
          The four numbers an operator needs before deciding to run anything:
          how much is configured, how much is due, and what the last run
          produced and cost.
        */}
        <AdminMetricRow>
          <AdminMetric
            label={t.discovery.queriesEnabled}
            value={snapshot.queries.enabled}
            hint={`${snapshot.queries.total} ${t.discovery.queriesTotal}`}
            href="/admin/discovery/queries"
          />
          <AdminMetric
            label={t.discovery.queriesDue}
            value={snapshot.queries.dueNow}
            tone={snapshot.queries.dueNow > 0 ? "attention" : "default"}
            href="/admin/discovery/queries"
          />
          <AdminMetric
            label={t.discovery.runCreatedLatest}
            value={latest?.created ?? "—"}
            hint={t.discovery.fromLatestRun}
          />
          <AdminMetric
            label={t.discovery.runErrorsLatest}
            value={latest?.errors ?? "—"}
            tone={(latest?.errors ?? 0) > 0 ? "critical" : "default"}
            hint={t.discovery.fromLatestRun}
          />
        </AdminMetricRow>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <DiscoveryRunForm
              providers={facets.providers}
              categories={facets.categories}
              initialCategory={initialCategory}
              initialProvider={initialProvider}
              labels={{
                runDiscovery: t.discovery.runDiscovery,
                running: t.discovery.running,
                formDescription: t.discovery.formDescription,
                topic: t.discovery.topic,
                allTopics: t.discovery.allTopics,
                provider: t.discovery.provider,
                allProviders: t.discovery.allProviders,
                queryLimit: t.discovery.queryLimit,
                resultLimit: t.discovery.resultLimit,
                runFailed: t.discovery.runFailed,
                ignoreSchedule: t.discovery.ignoreSchedule,
                ignoreScheduleHint: t.discovery.ignoreScheduleHint,
                nothingDue: t.discovery.nothingDue,
                summary: t.discovery.summary,
                pipelineSummary: t.discovery.pipelineSummary,
              }}
            />

            <LatestRunPanel t={t} locale={locale} run={latest} />
          </div>

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
        </div>

        <RunHistoryTable t={t} locale={locale} runs={snapshot.recentRuns} />

        <p className="text-xs text-muted-foreground">
          {t.discovery.afterRunHint}{" "}
          <Link
            href="/admin/candidates"
            className="text-primary hover:underline"
          >
            /admin/candidates
          </Link>
          .
        </p>
      </div>
    </>
  );
}
