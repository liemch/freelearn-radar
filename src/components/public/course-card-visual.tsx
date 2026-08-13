import type { CourseWithProvider } from "@/db/repositories/course-repository";
import type { Locale } from "@/lib/i18n/config";
import { getCourseVisual } from "@/domain/course/course-visual";
import { cn } from "@/lib/utils";

type CourseCardVisualProps = {
  course: CourseWithProvider;
  locale?: Locale;
  className?: string;
};

export function CourseCardVisual({
  course,
  className,
}: CourseCardVisualProps) {
  const visual = getCourseVisual(course);

  return (
    <div
      className={cn(
        "relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-surface-muted",
        className,
      )}
    >
      {visual.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote provider images with fallback
        <img
          src={visual.src}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <div
          className={cn(
            "flex size-full flex-col justify-end p-3",
            visual.toneClass,
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
            {visual.eyebrow}
          </span>
          <span className="font-display text-lg font-semibold leading-tight text-balance">
            {visual.title}
          </span>
        </div>
      )}
    </div>
  );
}
