import { notFound, redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
    <>
      <AdminPageHeader title={provider.name} />

      <div className="space-y-6">
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
      </div>
    </>
  );
}
