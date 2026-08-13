import Link from "next/link";
import { redirect } from "next/navigation";

import { DiscoveryRunForm } from "@/components/admin/discovery-run-form";
import { AdminLogoutButton } from "@/components/admin/logout-button";
import { listDiscoveryQueryFacets } from "@/db/repositories/discovery-query-repository";
import { getSession } from "@/lib/auth/guards";
import { withDb } from "@/lib/db-safe";

export const dynamic = "force-dynamic";

export default async function AdminDiscoveryPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const facets = await withDb(
    "admin.discovery.facets",
    (db) => listDiscoveryQueryFacets(db),
    { providers: [], categories: [] },
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin" className="hover:underline">
                Admin
              </Link>{" "}
              / Discovery
            </p>
            <h1 className="text-xl font-semibold">Discovery controls</h1>
          </div>
          <AdminLogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <DiscoveryRunForm
          providers={facets.providers}
          categories={facets.categories}
        />
        <p className="text-sm text-muted-foreground">
          After discovery, review candidates at{" "}
          <Link href="/admin/candidates" className="text-primary hover:underline">
            /admin/candidates
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
