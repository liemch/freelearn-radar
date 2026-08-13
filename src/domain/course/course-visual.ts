import type { CourseWithProvider } from "@/db/repositories/course-repository";

export type CourseVisual =
  | { type: "image"; src: string }
  | {
      type: "fallback";
      eyebrow: string;
      title: string;
      toneClass: string;
    };

const CATEGORY_TONES: Record<string, string> = {
  ai: "bg-slate-800 text-white",
  programming: "bg-indigo-900 text-white",
  "data-science": "bg-violet-900 text-white",
  cloud: "bg-sky-900 text-white",
  cybersecurity: "bg-zinc-800 text-white",
  business: "bg-stone-700 text-white",
  design: "bg-rose-900 text-white",
  default: "bg-primary/90 text-primary-foreground",
};

function providerTone(providerSlug?: string | null): string {
  const map: Record<string, string> = {
    coursera: "bg-blue-900 text-white",
    udemy: "bg-violet-950 text-white",
    edx: "bg-emerald-900 text-white",
    "microsoft-learn": "bg-sky-950 text-white",
    freecodecamp: "bg-neutral-800 text-white",
  };
  if (providerSlug && map[providerSlug]) {
    return map[providerSlug];
  }
  return CATEGORY_TONES.default;
}

export function getCourseVisual(course: CourseWithProvider): CourseVisual {
  const remote =
    course.imageStorageUrl ?? course.imageSourceUrl ?? null;
  if (remote && /^https:\/\//i.test(remote)) {
    return { type: "image", src: remote };
  }

  const providerName = course.provider?.name ?? "Course";
  const slug = course.provider?.slug;
  const shortTitle =
    course.title.length > 48 ? `${course.title.slice(0, 45)}…` : course.title;

  return {
    type: "fallback",
    eyebrow: providerName,
    title: shortTitle,
    toneClass: providerTone(slug),
  };
}
