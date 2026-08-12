import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/logout-button";
import { CourseStatusActions } from "@/components/admin/course-status-actions";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { listCourses } from "@/db/repositories/course-repository";
import {
  getCourseStatusLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";
import { getSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  let courses: Awaited<ReturnType<typeof listCourses>> = [];
  let databaseReady = true;

  try {
    courses = await listCourses(getDb());
  } catch {
    databaseReady = false;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin" className="hover:underline">
                Admin
              </Link>{" "}
              / Courses
            </p>
            <h1 className="text-xl font-semibold">Course management</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link href="/admin/courses/new">New course</Link>
            </Button>
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {!databaseReady ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Database not ready. Run migrate + seed first.
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
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
                  <td className="px-4 py-3">
                    {getPriceTypeLabel(course.priceType).label}
                  </td>
                  <td className="px-4 py-3">
                    {getCourseStatusLabel(course.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/courses/${course.id}`}>Edit</Link>
                      </Button>
                      <CourseStatusActions
                        courseId={course.id}
                        status={course.status}
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
                    No courses yet. Create one manually.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
