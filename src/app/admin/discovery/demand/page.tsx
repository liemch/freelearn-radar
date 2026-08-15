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
import { coverageThresholds } from "@/config/coverage-thresholds";
import { getUnmetIntentSummary } from "@/domain/coverage/unmet-intent";
import { withDb } from "@/lib/db-safe";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

export default async function AdminDiscoveryDemandPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  const demand = await withDb(
    "admin.demand.summary",
    (db) => getUnmetIntentSummary(db, { windowDays: 30, topN: 50 }),
    null,
  );

  return (
    <>
      <AdminPageHeader
        title={t.demand.heading}
        description={t.demand.description}
      />

      <div className="mb-4 rounded border border-border bg-card px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
        {t.demand.privacyHint}{" "}
        <span className="text-foreground">
          (lowResult ≤ {coverageThresholds.lowResultMax})
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/coverage" className="text-primary hover:underline">
          {t.demand.linkCoverage}
        </Link>
        <Link href="/admin/discovery" className="text-primary hover:underline">
          {t.demand.linkDiscovery}
        </Link>
        <Link
          href="/admin/discovery/queries"
          className="text-primary hover:underline"
        >
          {t.demand.linkQueries}
        </Link>
      </div>

      {demand ? (
        <AdminMetricRow className="mb-4">
          <AdminMetric
            label={t.demand.totalSearches}
            value={String(demand.totalSearches)}
          />
          <AdminMetric
            label={t.demand.zeroResult}
            value={String(demand.zeroResultSearches)}
          />
          <AdminMetric
            label={t.demand.lowResult}
            value={String(demand.lowResultSearches)}
          />
          <AdminMetric
            label={t.demand.healthyResult}
            value={String(demand.healthySearches)}
          />
        </AdminMetricRow>
      ) : null}

      <AdminPanel title={t.demand.tableHeading}>
        {!demand || demand.topUnmet.length === 0 ? (
          <AdminEmptyState message={t.demand.empty} />
        ) : (
          <AdminTable caption={t.demand.tableHeading}>
            <thead>
              <AdminTr>
                <AdminTh>{t.demand.query}</AdminTh>
                <AdminTh numeric>{t.demand.searches}</AdminTh>
                <AdminTh numeric>{t.demand.avgResults}</AdminTh>
                <AdminTh>{t.demand.outcome}</AdminTh>
                <AdminTh>{t.demand.lastSearched}</AdminTh>
              </AdminTr>
            </thead>
            <tbody>
              {demand.topUnmet.map((row) => (
                <AdminTr key={row.queryHash}>
                  <AdminTd>
                    <span className="font-medium">
                      {row.normalizedQuery ?? "(empty)"}
                    </span>
                    <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                      {row.queryHash.slice(0, 12)}…
                    </span>
                  </AdminTd>
                  <AdminTd numeric>{row.searches}</AdminTd>
                  <AdminTd numeric>{row.avgResultCount.toFixed(1)}</AdminTd>
                  <AdminTd>
                    <code className="text-xs">{row.outcome}</code>
                  </AdminTd>
                  <AdminTd>
                    {row.lastSearchedAt.toLocaleString(
                      locale === "vi" ? "vi-VN" : "en-GB",
                    )}
                  </AdminTd>
                </AdminTr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </AdminPanel>
    </>
  );
}
