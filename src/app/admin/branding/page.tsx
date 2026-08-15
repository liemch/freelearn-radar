import { BrandingEditForm } from "@/components/admin/branding-edit-form";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { resolveBranding } from "@/domain/branding/site-branding";
import { getSession } from "@/lib/auth/guards";
import { withDb } from "@/lib/db-safe";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminBrandingPage() {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const canWrite = session.role === "ADMIN";

  const branding = await withDb(
    "admin.branding",
    (db) => resolveBranding(db),
    null,
  );

  const hero = branding?.hero;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t.branding.heading}
        description={t.branding.description}
      />
      <BrandingEditForm
        canWrite={canWrite}
        initial={{
          heroEyebrow: hero?.eyebrow ?? "",
          heroTitle: hero?.title ?? "",
          heroDescription: hero?.description ?? "",
          searchPlaceholder: hero?.searchPlaceholder ?? "",
          heroImageAlt: hero?.heroImageAlt ?? "",
          logoUrl: branding?.logoUrl ?? null,
          logoCompactUrl: branding?.logoCompactUrl ?? null,
          faviconUrl: branding?.faviconUrl ?? null,
          heroImageUrl: branding?.heroImageUrl ?? null,
        }}
        labels={{
          brandHeading: t.branding.brandHeading,
          brandDescription: t.branding.brandDescription,
          homeHeading: t.branding.homeHeading,
          homeDescription: t.branding.homeDescription,
          logo: t.branding.logo,
          logoCompact: t.branding.logoCompact,
          favicon: t.branding.favicon,
          heroImage: t.branding.heroImage,
          upload: t.branding.upload,
          replace: t.branding.replace,
          restoreDefault: t.branding.restoreDefault,
          removeImage: t.branding.removeImage,
          heroEyebrow: t.branding.heroEyebrow,
          heroTitle: t.branding.heroTitle,
          heroDescription: t.branding.heroDescription,
          searchPlaceholder: t.branding.searchPlaceholder,
          heroImageAlt: t.branding.heroImageAlt,
          save: t.common.save,
          saving: t.common.saving,
          saved: t.branding.saved,
          saveFailed: t.branding.saveFailed,
          uploadFailed: t.branding.uploadFailed,
          previewMissing: t.branding.previewMissing,
          usingDefault: t.branding.usingDefault,
        }}
      />
      {!canWrite ? (
        <p className="text-sm text-muted-foreground">{t.branding.readOnly}</p>
      ) : null}
    </div>
  );
}
