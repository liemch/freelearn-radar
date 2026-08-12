import Link from "next/link";

import { CourseCard } from "@/components/public/course-card";
import type { CourseWithProvider } from "@/db/repositories/course-repository";

type CourseSectionProps = {
  title: string;
  subtitle?: string;
  courses: CourseWithProvider[];
  viewAllHref?: string;
};

export function CourseSection({
  title,
  subtitle,
  courses,
  viewAllHref,
}: CourseSectionProps) {
  if (courses.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </section>
  );
}
