import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CourseForm } from "@/components/admin/course-form";
import { getDb } from "@/db";
import { listCategories } from "@/db/repositories/category-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

export default async function AdminNewCoursePage() {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  let providers: Awaited<ReturnType<typeof listProviders>> = [];
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  let databaseReady = true;

  try {
    const db = getDb();
    [providers, categories] = await Promise.all([
      listProviders(db, false),
      listCategories(db),
    ]);
  } catch {
    databaseReady = false;
  }

  const formLabels = {
    title: t.courses.title,
    slug: t.courses.slug,
    provider: t.courses.provider,
    canonicalUrl: t.courses.canonicalUrl,
    outboundUrl: t.courses.outboundUrl,
    affiliateUrl: t.courses.affiliateUrl,
    shortDescription: t.courses.shortDescription,
    fullDescription: t.courses.fullDescription,
    instructor: t.courses.instructor,
    courseLanguage: t.courses.courseLanguage,
    level: t.courses.level,
    duration: t.courses.duration,
    priceType: t.courses.priceType,
    certificate: t.courses.certificate,
    qualityScore: t.courses.qualityScore,
    editorScore: t.courses.editorScore,
    status: t.common.status,
    categories: t.courses.categories,
    saving: t.common.saving,
    createCourse: t.courses.createCourse,
    saveChanges: t.courses.saveChanges,
    cancel: t.common.cancel,
    saveFailed: t.courses.saveFailed,
    unableToSave: t.courses.unableToSave,
    levelBeginner: t.courses.levelBeginner,
    levelIntermediate: t.courses.levelIntermediate,
    levelAdvanced: t.courses.levelAdvanced,
    levelAllLevels: t.courses.levelAllLevels,
    levelUnknown: t.courses.levelUnknown,
  };

  return (
    <>
      <AdminPageHeader title={t.courses.createCourse} />

      {!databaseReady || providers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {t.courses.seedRequired}
        </p>
      ) : (
        <CourseForm
          mode="create"
          providers={providers}
          categories={categories}
          labels={formLabels}
        />
      )}
    </>
  );
}
