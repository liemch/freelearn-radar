import { LocalizedLink } from "@/components/public/localized-link";
import { CourseCard } from "@/components/public/course-card";
import type { CourseWithProvider } from "@/db/repositories/course-repository";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type CourseSectionProps = {
  title: string;
  subtitle?: string;
  courses: CourseWithProvider[];
  locale: Locale;
  viewAllHref?: string;
  viewAllLabel?: string;
};

export function CourseSection({
  title,
  subtitle,
  courses,
  locale,
  viewAllHref,
  viewAllLabel,
}: CourseSectionProps) {
  if (courses.length === 0) {
    return null;
  }

  const viewAll = viewAllLabel ?? getDictionary(locale).sections.viewAll;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {viewAllHref ? (
          <LocalizedLink
            href={viewAllHref}
            className="shrink-0 text-sm font-medium text-primary hover:underline"
          >
            {viewAll}
          </LocalizedLink>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} locale={locale} />
        ))}
      </div>
    </section>
  );
}
