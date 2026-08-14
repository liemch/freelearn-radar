import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/logout-button";
import { ProviderEditForm } from "@/components/admin/provider-edit-form";
import { UrlShapeTryBox } from "@/components/admin/url-shape-try-box";
import { getDb } from "@/db";
import { findProviderById } from "@/db/repositories/provider-repository";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminProviderDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  const provider = await findProviderById(getDb(), id).catch(() => null);
  if (!provider) notFound();

  const canWrite = session.role === "ADMIN";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin" className="hover:underline">
                {t.common.admin}
              </Link>{" "}
              /{" "}
              <Link href="/admin/providers" className="hover:underline">
                {t.nav.providers}
              </Link>{" "}
              / {provider.name}
            </p>
            <h1 className="text-xl font-semibold">{provider.name}</h1>
          </div>
          <AdminLogoutButton
            label={t.common.signOut}
            signingOutLabel={t.common.signingOut}
          />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <p className="text-sm text-muted-foreground">
          {provider.slug} · {t.providers.domain}: {provider.domain}
        </p>

        <ProviderEditForm
          providerId={provider.id}
          canWrite={canWrite}
          initial={{
            active: provider.active,
            affiliateEnabled: provider.affiliateEnabled,
            affiliateTemplate: provider.affiliateTemplate ?? "",
          }}
          labels={{
            active: t.providers.active,
            affiliateEnabled: t.providers.affiliateEnabled,
            affiliateTemplate: t.providers.affiliateTemplate,
            save: t.providers.save,
            saving: t.common.saving,
            saved: t.providers.saved,
            saveFailed: t.providers.saveFailed,
          }}
        />

        <UrlShapeTryBox
          labels={{
            tryUrl: t.providers.tryUrl,
            tryUrlHint: t.providers.tryUrlHint,
            classify: t.providers.classify,
            classifying: t.providers.classifying,
          }}
        />
      </main>
    </div>
  );
}
