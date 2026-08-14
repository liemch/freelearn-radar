import { notFound, redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import { CourseForm } from "@/components/admin/course-form";
import { CourseStatusActions } from "@/components/admin/course-status-actions";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { getDb } from "@/db";
import { listCategories } from "@/db/repositories/category-repository";
import {
  findCourseById,
  getCourseCategoryIds,
} from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { getCourseStatusLabel } from "@/domain/course/labels";
import type { CourseStatus } from "@/domain/course/types";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

function courseStatusVariant(status: CourseStatus): BadgeProps["variant"] {
  switch (status) {
    case "PUBLISHED":
      return "success";
    case "EXPIRED":
    case "UNAVAILABLE":
      return "warning";
    case "ARCHIVED":
      return "outline";
    default:
      return "neutral";
  }
}

type EditCoursePageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditCoursePage({
  params,
}: EditCoursePageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const { id } = await params;

  let course: Awaited<ReturnType<typeof findCourseById>> = null;
  let providers: Awaited<ReturnType<typeof listProviders>> = [];
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  let categoryIds: string[] = [];

  try {
    const db = getDb();
    [course, providers, categories, categoryIds] = await Promise.all([
      findCourseById(db, id),
      listProviders(db, false),
      listCategories(db),
      getCourseCategoryIds(db, id),
    ]);
  } catch {
    notFound();
  }

  if (!course) {
    notFound();
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

  const statusLabels = {
    publish: t.courses.publish,
    unpublish: t.courses.unpublish,
    archive: t.courses.archive,
    statusUpdateFailed: t.courses.statusUpdateFailed,
    unableToUpdateStatus: t.courses.unableToUpdateStatus,
  };

  return (
    <>
      <AdminPageHeader
        title={course.title}
        meta={
          <>
            <Badge variant={courseStatusVariant(course.status)}>
              {getCourseStatusLabel(course.status)}
            </Badge>
            <span className="font-mono text-[0.6875rem] text-muted-foreground">
              {course.slug}
            </span>
          </>
        }
        actions={
          <CourseStatusActions
            courseId={course.id}
            status={course.status}
            labels={statusLabels}
          />
        }
      />

      <AdminPanel>
        <CourseForm
          mode="edit"
          courseId={course.id}
          providers={providers}
          categories={categories}
          labels={formLabels}
          initialValues={{
            title: course.title,
            slug: course.slug,
            shortDescription: course.shortDescription ?? "",
            description: course.description ?? "",
            providerId: course.providerId,
            categoryIds,
            canonicalUrl: course.canonicalUrl,
            outboundUrl: course.outboundUrl,
            affiliateUrl: course.affiliateUrl ?? "",
            instructor: course.instructor ?? "",
            language: course.language ?? "",
            level: course.level,
            durationMinutes:
              course.durationMinutes != null
                ? String(course.durationMinutes)
                : "",
            priceType: course.priceType,
            certificateType: course.certificateType,
            qualityScore:
              course.qualityScore != null ? String(course.qualityScore) : "",
            editorScore:
              course.editorScore != null ? String(course.editorScore) : "",
            status: course.status,
          }}
        />
      </AdminPanel>
    </>
  );
}
