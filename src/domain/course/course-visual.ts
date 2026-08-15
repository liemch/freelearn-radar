import type { CourseWithProvider } from "@/db/repositories/course-repository";

export type CourseVisual = {
  /** Remote thumbnail when the pipeline captured one; otherwise render the tile. */
  src: string | null;
  eyebrow: string;
  title: string;
  toneClass: string;
};

/** Minimal course fields needed for card/detail presentation. */
export type CourseVisualSource = Pick<
  CourseWithProvider,
  | "id"
  | "slug"
  | "title"
  | "imageOverrideUrl"
  | "imageResolvedUrl"
  | "imageStorageUrl"
  | "imageSourceUrl"
> & {
  provider?: { name?: string | null } | null;
};

const TILE_TONES = [
  "course-tile-1",
  "course-tile-2",
  "course-tile-3",
  "course-tile-4",
  "course-tile-5",
] as const;

function toneFor(seed: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return TILE_TONES[Math.abs(hash) % TILE_TONES.length]!;
}

function isDisplayableImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  // Admin uploads are served same-origin; automatic pipeline uses HTTPS.
  if (url.startsWith("/api/course-media/")) return true;
  return /^https:\/\//i.test(url);
}

/**
 * Presentation priority (M23.1):
 * ADMIN_OVERRIDE → OFFICIAL/resolved → storage → trusted source → branded tile
 */
export function getCourseVisual(course: CourseVisualSource): CourseVisual {
  const remote =
    course.imageOverrideUrl ??
    course.imageResolvedUrl ??
    course.imageStorageUrl ??
    course.imageSourceUrl ??
    null;
  const shortTitle =
    course.title.length > 64 ? `${course.title.slice(0, 61)}…` : course.title;

  return {
    src: isDisplayableImageUrl(remote) ? remote : null,
    eyebrow: course.provider?.name ?? "",
    title: shortTitle,
    toneClass: toneFor(course.slug || course.id || course.title),
  };
}
