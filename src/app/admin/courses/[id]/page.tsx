import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CourseForm } from "@/components/admin/course-form";
import { CourseStatusActions } from "@/components/admin/course-status-actions";
import { getDb } from "@/db";
import { listCategories } from "@/db/repositories/category-repository";
import {
  findCourseById,
  getCourseCategoryIds,
} from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { getSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin/courses" className="hover:underline">
                Courses
              </Link>{" "}
              / Edit
            </p>
            <h1 className="text-xl font-semibold">{course.title}</h1>
          </div>
          <CourseStatusActions courseId={course.id} status={course.status} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <CourseForm
          mode="edit"
          courseId={course.id}
          providers={providers}
          categories={categories}
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
      </main>
    </div>
  );
}
