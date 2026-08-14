import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { listProviders } from "@/db/repositories/provider-repository";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  let providers: Awaited<ReturnType<typeof listProviders>> = [];
  try {
    providers = await listProviders(getDb(), false);
  } catch {
    providers = [];
  }

  return (
    <>
      <AdminPageHeader
        title={t.providers.heading}
        description={t.providers.description}
      />

      <AdminPanel
        title={t.providers.heading}
        actions={<Badge variant="outline">{providers.length}</Badge>}
        flush
      >
        {providers.length === 0 ? (
          <AdminEmptyState message={t.providers.empty} />
        ) : (
          <ul className="divide-y divide-border/60">
            {providers.map((provider) => (
              <li
                key={provider.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 transition hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/providers/${provider.id}`}
                      className="text-[0.8125rem] font-semibold hover:text-primary"
                    >
                      {provider.name}
                    </Link>
                    <Badge variant={provider.active ? "success" : "outline"}>
                      {t.providers.active}:{" "}
                      {provider.active ? t.common.yes : t.common.no}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {provider.slug} · {t.providers.domain}: {provider.domain}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/providers/${provider.id}`}>
                    {t.common.edit}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>
    </>
  );
}
