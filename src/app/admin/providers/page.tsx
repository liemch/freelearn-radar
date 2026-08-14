import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/logout-button";
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin" className="hover:underline">
                {t.common.admin}
              </Link>{" "}
              / {t.nav.providers}
            </p>
            <h1 className="text-xl font-semibold">{t.providers.heading}</h1>
          </div>
          <AdminLogoutButton
            label={t.common.signOut}
            signingOutLabel={t.common.signingOut}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
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
      </main>
    </div>
  );
}
