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
import type { CertificateType, CourseStatus } from "@/domain/course/types";
import {
  getCourseStatusLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

const CERTIFICATE_VALUES = new Set<CertificateType>([
  "FREE_CERTIFICATE",
  "PAID_CERTIFICATE",
  "NO_CERTIFICATE",
  "UNKNOWN",
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

function parseCertificate(
  raw: string | string[] | undefined,
): CertificateType | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && CERTIFICATE_VALUES.has(value as CertificateType)) {
    return value as CertificateType;
  }
  return undefined;
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
  const certificateType = parseCertificate(params.certificate);

  let courses: Awaited<ReturnType<typeof listCourses>> = [];
  let databaseReady = true;

  try {
    courses = await listCourses(getDb(), {
      certificateType,
      limit: 200,
    });
  } catch {
    databaseReady = false;
  }

  const statusLabels = {
    publish: t.courses.publish,
    unpublish: t.courses.unpublish,
    archive: t.courses.archive,
    statusUpdateFailed: t.courses.statusUpdateFailed,
    unableToUpdateStatus: t.courses.unableToUpdateStatus,
    publishBlockedHint: t.courses.publishBlockedHint,
  };

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
