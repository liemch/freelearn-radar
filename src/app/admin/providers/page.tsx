import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
      <AdminPageHeader title={t.providers.heading} />

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.providers.description}</p>
        {providers.map((provider) => (
          <article
            key={provider.id}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  href={`/admin/providers/${provider.id}`}
                  className="text-lg font-semibold hover:text-primary"
                >
                  {provider.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {provider.slug} · {t.providers.domain}: {provider.domain}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.providers.active}: {provider.active ? t.common.yes : t.common.no}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/providers/${provider.id}`}>
                  {t.common.edit}
                </Link>
              </Button>
            </div>
          </article>
        ))}
        {providers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {t.providers.empty}
          </p>
        ) : null}
      </div>
    </>
  );
}
