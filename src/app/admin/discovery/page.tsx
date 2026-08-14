import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AiDiagnosePanel } from "@/components/admin/ai-diagnose-panel";
import { DiscoveryRunForm } from "@/components/admin/discovery-run-form";
import { HealthPanel } from "@/components/admin/health-panel";
import { RunHistoryTable } from "@/components/admin/run-history-table";
import { Badge } from "@/components/ui/badge";
import { listDiscoveryQueryFacets } from "@/db/repositories/discovery-query-repository";
import {
  getOperationsSnapshot,
  type OperationsSnapshot,
} from "@/domain/admin/operations-snapshot";
import { getSession } from "@/lib/auth/guards";
import { withDb } from "@/lib/db-safe";
import { getAdminDictionary } from "@/lib/i18n/admin";
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

export default async function AdminDiscoveryPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  const [facets, snapshot] = await Promise.all([
    withDb("admin.discovery.facets", (db) => listDiscoveryQueryFacets(db), {
      providers: [],
      categories: [],
    }),
    withDb(
      "admin.discovery.snapshot",
      (db) => getOperationsSnapshot(db, { runHistoryLimit: 10 }),
      EMPTY_SNAPSHOT,
    ),
  ]);

  return (
    <>
      <AdminPageHeader
        title={t.discovery.controls}
        description={t.discovery.description}
        actions={
          <>
            <Badge variant="neutral">
              {t.discovery.queriesEnabled}: {snapshot.queries.enabled}
            </Badge>
            <Badge
              variant={snapshot.queries.dueNow > 0 ? "info" : "outline"}
            >
              {t.discovery.queriesDue}: {snapshot.queries.dueNow}
            </Badge>
          </>
        }
      />

      <div className="space-y-6">
        {/*
          Health first: the question an operator opens this page with is "is it
          running?", not "let me run it". Running it before knowing that is how
          you end up triggering a batch against a broken provider.
        */}
        <HealthPanel
          t={t}
          locale={locale}
          items={[
            { label: t.health.discovery, health: snapshot.discovery },
            { label: t.health.monitor, health: snapshot.monitor },
          ]}
        />

        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <DiscoveryRunForm
            providers={facets.providers}
            categories={facets.categories}
            labels={{
              runDiscovery: t.discovery.runDiscovery,
              running: t.discovery.running,
              formDescription: t.discovery.formDescription,
              topic: t.discovery.topic,
              allTopics: t.discovery.allTopics,
              provider: t.discovery.provider,
              allProviders: t.discovery.allProviders,
              queryLimit: t.discovery.queryLimit,
              runFailed: t.discovery.runFailed,
              ignoreSchedule: t.discovery.ignoreSchedule,
              ignoreScheduleHint: t.discovery.ignoreScheduleHint,
              nothingDue: t.discovery.nothingDue,
              summary: t.discovery.summary,
            }}
          />

          <AiDiagnosePanel
            labels={{
              heading: t.discovery.aiCheckHeading,
              description: t.discovery.aiCheckDescription,
              run: t.discovery.aiCheckRun,
              running: t.discovery.aiCheckRunning,
              success: t.discovery.aiCheckSuccess,
              failure: t.discovery.aiCheckFailure,
              requestFailed: t.discovery.aiCheckRequestFailed,
            }}
          />
        </div>

        <RunHistoryTable t={t} locale={locale} runs={snapshot.recentRuns} />

        <p className="text-sm text-muted-foreground">
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
