import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPanel } from "@/components/admin/admin-panel";
import { AdminStatus } from "@/components/admin/admin-status";
import type { DiscoveryRunRecord } from "@/domain/admin/operations-snapshot";
import type { AdminDictionary } from "@/lib/i18n/admin/types";

type LatestRunPanelProps = {
  t: AdminDictionary;
  locale: string;
  run: DiscoveryRunRecord | null;
};

/**
 * The last run at a glance.
 *
 * Duration is absent on purpose: the audit row records when a run finished, not
 * how long it took, and inventing an elapsed time would be the easiest number
 * on this page to believe and the least true.
 *
 * A field the payload does not carry renders as a dash rather than zero — "not
 * recorded" and "found nothing" are different answers.
 */
export function LatestRunPanel({ t, locale, run }: LatestRunPanelProps) {
  if (!run) {
    return (
      <AdminPanel title={t.discovery.latestRun} flush>
        <AdminEmptyState
          message={t.discovery.latestRunNone}
          hint={t.discovery.runHistoryDescription}
        />
      </AdminPanel>
    );
  }

  const failed = (run.errors ?? 0) > 0;
  const dash = (value: number | null) => (value == null ? "—" : String(value));

  const facts: Array<{ label: string; value: string; strong?: boolean }> = [
    {
      label: t.discovery.runTime,
      value: run.at.toLocaleString(locale === "vi" ? "vi-VN" : "en-GB"),
    },
    { label: t.discovery.runScope, value: run.scope },
    { label: t.discovery.runActor, value: run.actorType },
    { label: t.discovery.runQueries, value: dash(run.queriesProcessed) },
    { label: t.discovery.runCreated, value: dash(run.created), strong: true },
    { label: t.discovery.runDuplicates, value: dash(run.duplicates) },
    { label: t.discovery.runInvalid, value: dash(run.invalid) },
    { label: t.discovery.runErrors, value: dash(run.errors) },
  ];

  return (
    <AdminPanel
      title={t.discovery.latestRun}
      actions={
        <AdminStatus
          state={failed ? "degraded" : "healthy"}
          label={failed ? t.health.degraded : t.health.healthy}
        />
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
              {fact.label}
            </dt>
            <dd
              className={
                fact.strong
                  ? "mt-0.5 truncate text-sm font-semibold tabular-nums"
                  : "mt-0.5 truncate text-sm tabular-nums"
              }
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </AdminPanel>
  );
}
