import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import {
  AdminTable,
  AdminTd,
  AdminTh,
  AdminTr,
} from "@/components/admin/admin-table";
import { listDiscoveryCategoryStats } from "@/db/repositories/coupon-repository";
import { withDb } from "@/lib/db-safe";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

function isStarved(row: {
  publishedCount: number;
  zeroCandidateRuns: number;
  queriesRun: number;
}): boolean {
  if (row.queriesRun === 0) return false;
  return row.publishedCount <= 2 || row.zeroCandidateRuns >= 3;
}

export default async function AdminCoveragePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  const stats = await withDb(
    "admin.coverage.stats",
    (db) => listDiscoveryCategoryStats(db),
    [],
  );

  const sorted = [...stats].sort((a, b) => {
    const aScore = a.zeroCandidateRuns * 10 - a.publishedCount;
    const bScore = b.zeroCandidateRuns * 10 - b.publishedCount;
    return bScore - aScore;
  });

  return (
    <>
      <AdminPageHeader
        title={t.coverage.heading}
        description={t.coverage.description}
      />

      <div className="mb-4 rounded border border-border bg-card px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
        {t.coverage.starvationHint}
      </div>

      <AdminPanel title={t.coverage.heading}>
        {sorted.length === 0 ? (
          <AdminEmptyState message={t.coverage.empty} />
        ) : (
          <AdminTable caption={t.coverage.heading}>
            <thead>
              <AdminTr>
                <AdminTh>{t.coverage.category}</AdminTh>
                <AdminTh numeric>{t.coverage.queriesRun}</AdminTh>
                <AdminTh numeric>{t.coverage.candidatesFound}</AdminTh>
                <AdminTh numeric>{t.coverage.verified}</AdminTh>
                <AdminTh numeric>{t.coverage.published}</AdminTh>
                <AdminTh numeric>{t.coverage.zeroCandidateRuns}</AdminTh>
                <AdminTh>{t.coverage.lastDiscovered}</AdminTh>
              </AdminTr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const starved = isStarved(row);
                return (
                  <AdminTr key={row.id}>
                    <AdminTd>
                      <span className="font-medium">{row.categorySlug}</span>
                      {starved ? (
                        <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                          {t.coverage.starved}
                        </span>
                      ) : null}
                    </AdminTd>
                    <AdminTd numeric>{row.queriesRun}</AdminTd>
                    <AdminTd numeric>{row.candidatesFound}</AdminTd>
                    <AdminTd numeric>{row.verifiedCount}</AdminTd>
                    <AdminTd numeric>{row.publishedCount}</AdminTd>
                    <AdminTd numeric>{row.zeroCandidateRuns}</AdminTd>
                    <AdminTd>
                      {row.lastDiscoveredAt
                        ? row.lastDiscoveredAt.toLocaleString(
                            locale === "vi" ? "vi-VN" : "en-GB",
                          )
                        : "—"}
                    </AdminTd>
                  </AdminTr>
                );
              })}
            </tbody>
          </AdminTable>
        )}
      </AdminPanel>
    </>
  );
}
