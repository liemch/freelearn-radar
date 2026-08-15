import { CourseCard } from "@/components/public/course-card";
import type { CourseWithProvider } from "@/db/repositories/course-repository";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type CourseGridProps = {
  courses: CourseWithProvider[];
  locale: Locale;
  /** Number of leading cards to load eagerly; use on the first grid of a page. */
  priorityCount?: number;
  className?: string;
};

/**
 * The single grid used by every catalogue surface, so a card is the same width
 * on the homepage, in search, and on a topic page.
 *
 * `auto-fill` rather than fixed column counts: it derives the column count from
 * a minimum readable card width, and — importantly for a catalogue that may hold
 * only one or two courses — it leaves the empty tracks empty instead of
 * stretching a lone card across the full page.
 */
export function CourseGrid({
  courses,
  locale,
  priorityCount = 0,
  className,
}: CourseGridProps) {
  if (courses.length === 0) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fill,minmax(min(16.5rem,100%),1fr))] gap-4 sm:gap-5",
        className,
      )}
    >
      {courses.map((course, index) => (
        <CourseCard
          key={course.id}
          course={course}
          locale={locale}
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}
