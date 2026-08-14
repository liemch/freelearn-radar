import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
  };

  return (
    <>
      <AdminPageHeader
        title={t.courses.management}
        actions={
          <Button asChild>
            <Link href="/admin/courses/new">{t.courses.newCourse}</Link>
          </Button>
        }
      />

      <div className="space-y-6">
        {certificateType ? (
          <p className="text-sm text-muted-foreground">
            {t.courses.certificate}: {certificateType}{" "}
            <Link href="/admin/courses" className="text-primary hover:underline">
              ({t.common.all})
            </Link>
          </p>
        ) : null}

        {!databaseReady ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {t.courses.databaseNotReady}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">{t.courses.management}</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.courses.title}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.courses.provider}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {t.courses.price}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {t.common.status}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {t.common.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/courses/${course.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {course.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{course.slug}</p>
                  </td>
                  <td className="px-4 py-3">{course.provider.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {getPriceTypeLabel(course.priceType).label}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant={courseStatusVariant(course.status)}>
                      {getCourseStatusLabel(course.status)}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/courses/${course.id}`}>
                          {t.common.edit}
                        </Link>
                      </Button>
                      <CourseStatusActions
                        courseId={course.id}
                        status={course.status}
                        labels={statusLabels}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {courses.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {t.courses.emptyCreate}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
