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
import { DiscoveryQueryToggle } from "@/components/admin/discovery-query-toggle";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { listDiscoveryQueries } from "@/db/repositories/discovery-query-repository";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

export default async function AdminDiscoveryQueriesPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const canWrite = session.role === "ADMIN";

  let queries: Awaited<ReturnType<typeof listDiscoveryQueries>> = [];
  try {
    queries = await listDiscoveryQueries(getDb());
  } catch {
    queries = [];
  }

  return (
    <>
      <AdminPageHeader
        title={t.discoveryQueries.heading}
        description={t.discoveryQueries.description}
      />

      <AdminPanel
        title={t.discoveryQueries.heading}
        actions={<Badge variant="outline">{queries.length}</Badge>}
        flush
      >
        {queries.length === 0 ? (
          <AdminEmptyState message={t.discoveryQueries.empty} />
        ) : (
          <AdminTable caption={t.discoveryQueries.heading}>
            <thead>
              <tr>
                <AdminTh>{t.discovery.query}</AdminTh>
                <AdminTh>{t.discovery.provider}</AdminTh>
                <AdminTh numeric>{t.discoveryQueries.junkRate}</AdminTh>
                <AdminTh numeric>{t.discoveryQueries.successCount}</AdminTh>
                <AdminTh numeric>{t.discoveryQueries.failureCount}</AdminTh>
                <AdminTh>{t.discoveryQueries.enabled}</AdminTh>
              </tr>
            </thead>
            <tbody>
              {queries.map((query) => (
                <AdminTr key={query.id}>
                  <AdminTd>
                    <p className="font-medium">{query.query}</p>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {query.category}
                    </p>
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap text-muted-foreground">
                    {query.provider}
                  </AdminTd>
                  <AdminTd numeric className="text-muted-foreground">
                    {query.junkRate ?? t.common.notSet}
                  </AdminTd>
                  <AdminTd numeric>{query.successCount}</AdminTd>
                  <AdminTd numeric className="text-muted-foreground">
                    {query.failureCount}
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap">
                    {canWrite ? (
                      <DiscoveryQueryToggle
                        queryId={query.id}
                        enabled={query.enabled}
                        labels={{
                          enabled: t.discoveryQueries.enabled,
                          toggleFailed: t.discoveryQueries.toggleFailed,
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground">
                        {query.enabled ? t.common.yes : t.common.no}
                      </span>
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
