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
    <section className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
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
            className="shrink-0 self-start text-sm font-medium text-primary hover:underline sm:self-auto"
          >
            {viewAll}
          </LocalizedLink>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} locale={locale} />
        ))}
      </div>
    </section>
  );
}
