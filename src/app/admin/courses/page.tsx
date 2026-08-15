import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import {
  AdminTable,
  AdminTd,
  AdminTh,
  AdminTr,
} from "@/components/admin/admin-table";
import { CourseStatusActions } from "@/components/admin/course-status-actions";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { listCourses } from "@/db/repositories/course-repository";
import type {
  CertificateType,
  CourseImageSourceType,
  CourseImageStatus,
  CourseStatus,
} from "@/domain/course/types";
import {
  getCourseStatusLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CERTIFICATE_VALUES = new Set<CertificateType>([
  "FREE_CERTIFICATE",
  "PAID_CERTIFICATE",
  "NO_CERTIFICATE",
  "UNKNOWN",
]);

const STATUS_VALUES = new Set<CourseStatus>([
  "DRAFT",
  "PUBLISHED",
  "EXPIRED",
  "UNAVAILABLE",
  "ARCHIVED",
]);

const IMAGE_STATUS_VALUES = new Set<CourseImageStatus>([
  "OK",
  "MISSING",
  "BROKEN",
  "FALLBACK",
  "BLOCKED",
  "PENDING",
]);

const IMAGE_SOURCE_VALUES = new Set<CourseImageSourceType>([
  "OFFICIAL",
  "TRUSTED_METADATA",
  "CACHED",
  "CATEGORY_FALLBACK",
  "PROVIDER_FALLBACK",
  "ADMIN_OVERRIDE",
  "NONE",
]);

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

function firstParam(
  raw: string | string[] | undefined,
): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCoursesPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const params = await searchParams;

  const certificateRaw = firstParam(params.certificate);
  const certificateType =
    certificateRaw && CERTIFICATE_VALUES.has(certificateRaw as CertificateType)
      ? (certificateRaw as CertificateType)
      : undefined;

  const statusRaw = firstParam(params.status);
  const status =
    statusRaw && STATUS_VALUES.has(statusRaw as CourseStatus)
      ? (statusRaw as CourseStatus)
      : undefined;

  const imageStatusRaw = firstParam(params.imageStatus);
  const imageStatus =
    imageStatusRaw &&
    IMAGE_STATUS_VALUES.has(imageStatusRaw as CourseImageStatus)
      ? (imageStatusRaw as CourseImageStatus)
      : undefined;

  const imageSourceRaw = firstParam(params.imageSource);
  const imageSourceType =
    imageSourceRaw &&
    IMAGE_SOURCE_VALUES.has(imageSourceRaw as CourseImageSourceType)
      ? (imageSourceRaw as CourseImageSourceType)
      : undefined;

  const duplicatesOnly = firstParam(params.duplicates) === "1";

  let courses: Awaited<ReturnType<typeof listCourses>> = [];
  let databaseReady = true;

  try {
    courses = await listCourses(getDb(), {
      certificateType,
      status,
      imageStatus,
      imageSourceType,
      duplicatesOnly,
      excludeArchived: !status && !duplicatesOnly,
      limit: 200,
    });
  } catch {
    databaseReady = false;
  }

  const statusLabels = {
    publish: t.courses.publish,
    unpublish: t.courses.unpublish,
    archive: t.courses.archive,
    restore: t.courses.restore,
    statusUpdateFailed: t.courses.statusUpdateFailed,
    unableToUpdateStatus: t.courses.unableToUpdateStatus,
    publishBlockedHint: t.courses.publishBlockedHint,
  };

  const filters: Array<{ key: string; label: string; href: string; active: boolean }> = [
    {
      key: "default",
      label: t.courses.filterActive,
      href: "/admin/courses",
      active: !status && !imageStatus && !imageSourceType && !duplicatesOnly && !certificateType,
    },
    {
      key: "PUBLISHED",
      label: t.courses.filterPublished,
      href: "/admin/courses?status=PUBLISHED",
      active: status === "PUBLISHED",
    },
    {
      key: "DRAFT",
      label: t.courses.filterDraft,
      href: "/admin/courses?status=DRAFT",
      active: status === "DRAFT",
    },
    {
      key: "ARCHIVED",
      label: t.courses.filterArchived,
      href: "/admin/courses?status=ARCHIVED",
      active: status === "ARCHIVED",
    },
    {
      key: "MISSING",
      label: t.courses.filterMissingImage,
      href: "/admin/courses?imageStatus=MISSING",
      active: imageStatus === "MISSING",
    },
    {
      key: "BROKEN",
      label: t.courses.filterBrokenImage,
      href: "/admin/courses?imageStatus=BROKEN",
      active: imageStatus === "BROKEN",
    },
    {
      key: "FALLBACK",
      label: t.courses.filterFallbackImage,
      href: "/admin/courses?imageStatus=FALLBACK",
      active: imageStatus === "FALLBACK",
    },
    {
      key: "ADMIN",
      label: t.courses.filterAdminImage,
      href: "/admin/courses?imageSource=ADMIN_OVERRIDE",
      active: imageSourceType === "ADMIN_OVERRIDE",
    },
    {
      key: "DUP",
      label: t.courses.filterDuplicates,
      href: "/admin/courses?duplicates=1",
      active: duplicatesOnly,
    },
  ];

  return (
    <>
      <AdminPageHeader
        title={t.courses.management}
        description={t.courses.description}
        meta={
          certificateType ? (
            <span className="text-xs text-muted-foreground">
              {t.courses.certificate}: {certificateType}{" "}
              <Link
                href="/admin/courses"
                className="text-primary hover:underline"
              >
                ({t.common.all})
              </Link>
            </span>
          ) : undefined
        }
        actions={
          <Button asChild size="sm">
            <Link href="/admin/courses/new">{t.courses.newCourse}</Link>
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {filters.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "rounded border px-2.5 py-1 text-[0.75rem] transition",
              item.active
                ? "border-foreground/30 bg-muted font-medium text-foreground"
                : "border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        {!databaseReady ? (
          <AdminPanel>
            <p className="text-[0.8125rem] text-muted-foreground">
              {t.courses.databaseNotReady}
            </p>
          </AdminPanel>
        ) : null}

        <AdminPanel
          title={t.courses.heading}
          actions={<Badge variant="outline">{courses.length}</Badge>}
          flush
        >
          {courses.length === 0 ? (
            <AdminEmptyState message={t.courses.emptyCreate} />
          ) : (
            <AdminTable caption={t.courses.management}>
              <thead>
                <tr>
                  <AdminTh>{t.courses.title}</AdminTh>
                  <AdminTh>{t.courses.provider}</AdminTh>
                  <AdminTh>{t.courses.price}</AdminTh>
                  <AdminTh>{t.common.status}</AdminTh>
                  <AdminTh>{t.common.actions}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <AdminTr key={course.id}>
                    <AdminTd>
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {course.title}
                      </Link>
                      <p className="text-[0.6875rem] text-muted-foreground">
                        {course.slug}
                      </p>
                    </AdminTd>
                    <AdminTd className="text-muted-foreground">
                      {course.provider.name}
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap">
                      {getPriceTypeLabel(course.priceType).label}
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <Badge variant={courseStatusVariant(course.status)}>
                          {getCourseStatusLabel(course.status)}
                        </Badge>
                        {course.status === "PUBLISHED" &&
                        !isEligibleForFreeLists(course.priceType) ? (
                          <Badge variant="warning" className="w-fit">
                            {t.courses.hiddenFromCatalog}
                          </Badge>
                        ) : null}
                      </div>
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/courses/${course.id}`}>
                            {t.common.edit}
                          </Link>
                        </Button>
                        <CourseStatusActions
                          courseId={course.id}
                          status={course.status}
                          priceType={course.priceType}
                          labels={statusLabels}
                        />
                      </div>
                    </AdminTd>
                  </AdminTr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </AdminPanel>
      </div>
    </>
  );
}
