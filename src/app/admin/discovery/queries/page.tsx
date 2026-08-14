import Link from "next/link";
import { redirect } from "next/navigation";

import { DiscoveryQueryToggle } from "@/components/admin/discovery-query-toggle";
import { AdminLogoutButton } from "@/components/admin/logout-button";
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin" className="hover:underline">
                {t.common.admin}
              </Link>{" "}
              / {t.nav.discoveryQueries}
            </p>
            <h1 className="text-xl font-semibold">
              {t.discoveryQueries.heading}
            </h1>
          </div>
          <AdminLogoutButton
            label={t.common.signOut}
            signingOutLabel={t.common.signingOut}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
        <p className="text-sm text-muted-foreground">
          {t.discoveryQueries.description}
        </p>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 font-medium">{t.discovery.query}</th>
                <th className="px-4 py-3 font-medium">{t.discovery.provider}</th>
                <th className="px-4 py-3 font-medium">
                  {t.discoveryQueries.junkRate}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t.discoveryQueries.successCount}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t.discoveryQueries.failureCount}
                </th>
                <th className="px-4 py-3 font-medium">
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
                  <td className="px-4 py-3">{query.provider}</td>
                  <td className="px-4 py-3">
                    {query.junkRate ?? t.common.notSet}
                  </td>
                  <td className="px-4 py-3">{query.successCount}</td>
                  <td className="px-4 py-3">{query.failureCount}</td>
                  <td className="px-4 py-3">
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
      </main>
    </div>
  );
}
