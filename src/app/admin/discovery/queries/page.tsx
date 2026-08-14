import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DiscoveryQueryToggle } from "@/components/admin/discovery-query-toggle";
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
      <AdminPageHeader title={t.discoveryQueries.heading} />

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t.discoveryQueries.description}
        </p>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">{t.discoveryQueries.heading}</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.discovery.query}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {t.discovery.provider}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {t.discoveryQueries.junkRate}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {t.discoveryQueries.successCount}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {t.discoveryQueries.failureCount}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {t.discoveryQueries.enabled}
                </th>
              </tr>
            </thead>
            <tbody>
              {queries.map((query) => (
                <tr key={query.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{query.query}</p>
                    <p className="text-xs text-muted-foreground">
                      {query.category}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {query.provider}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {query.junkRate ?? t.common.notSet}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {query.successCount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {query.failureCount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
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
                      <span>
                        {query.enabled ? t.common.yes : t.common.no}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {queries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {t.discoveryQueries.empty}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
