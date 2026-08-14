import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import { SearchBenchmarkForm } from "@/components/admin/search-benchmark-form";
import { getDb } from "@/db";
import { searchThresholds } from "@/config/search-thresholds";
import { buildSearchBaseline } from "@/domain/search/baseline";
import { listRecentBenchmarkRuns } from "@/domain/search/benchmark";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

function formatRate(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export default async function AdminSearchPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  let baseline: Awaited<ReturnType<typeof buildSearchBaseline>> | null = null;
  let runs: Awaited<ReturnType<typeof listRecentBenchmarkRuns>> = [];

  try {
    const db = getDb();
    [baseline, runs] = await Promise.all([
      buildSearchBaseline(db, { windowDays: 30, topN: 25 }),
      listRecentBenchmarkRuns(db, 8),
    ]);
  } catch {
    // DB optional for page render
  }

  return (
    <>
      <AdminPageHeader
        title={t.search.heading}
        description={t.search.description}
      />

      <div className="mb-4 rounded border border-border bg-card px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
        <p>
          {t.search.thresholdsVersion}:{" "}
          <span className="font-medium text-foreground">
            {searchThresholds.version}
          </span>
        </p>
        <p className="mt-1">
          {t.search.gateBHint}{" "}
          <code className="text-foreground">docs/GATE_B_INTENT_DIAGNOSIS.md</code>
        </p>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-4">
        <MetricCard
          label={t.search.metricTotal}
          value={baseline ? String(baseline.totalSearches) : "—"}
        />
        <MetricCard
          label={t.search.metricZeroRate}
          value={baseline ? formatRate(baseline.zeroResultRate) : "—"}
        />
        <MetricCard
          label={t.search.metricUnmetRate}
          value={baseline ? formatRate(baseline.unmetIntentRate) : "—"}
        />
        <MetricCard
          label={t.search.metricLatency}
          value={
            baseline?.latencyP95Ms == null
              ? "—"
              : `${baseline.latencyP95Ms} ms`
          }
        />
      </div>

      {session.role === "ADMIN" ? (
        <div className="mb-4">
          <SearchBenchmarkForm
            labels={{
              title: t.search.benchmarkTitle,
              description: t.search.benchmarkDescription,
              run: t.search.benchmarkRun,
              running: t.search.benchmarkRunning,
              runFailed: t.search.benchmarkFailed,
              summary: t.search.benchmarkSummary,
            }}
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel title={t.search.topQueries} flush>
          {!baseline || baseline.topQueries.length === 0 ? (
            <AdminEmptyState message={t.search.emptyBaseline} />
          ) : (
            <ul className="divide-y divide-border/60">
              {baseline.topQueries.map((row) => (
                <li
                  key={row.queryHash}
                  className="flex items-center justify-between gap-3 px-3.5 py-2 text-[0.8125rem]"
                >
                  <span className="min-w-0 truncate">
                    {row.normalizedQuery ?? row.queryHash.slice(0, 12)}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>

        <AdminPanel title={t.search.recentRuns} flush>
          {runs.length === 0 ? (
            <AdminEmptyState message={t.search.emptyRuns} />
          ) : (
            <ul className="divide-y divide-border/60">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2 text-[0.8125rem]"
                >
                  <span className="min-w-0">
                    {run.retrievalMode} · {run.datasetVersion}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {run.latencyP95 == null ? "—" : `${run.latencyP95}ms`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>

      {baseline?.note ? (
        <p className="mt-4 text-[0.75rem] text-muted-foreground">
          {baseline.note}
        </p>
      ) : null}
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <AdminPanel>
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </AdminPanel>
  );
}
