import type { CourseWithProvider } from "@/db/repositories/course-repository";

export type CourseVisual = {
  /** Remote thumbnail when the pipeline captured one; otherwise render the tile. */
  src: string | null;
  eyebrow: string;
  title: string;
  toneClass: string;
};

const TILE_TONES = [
  "course-tile-1",
  "course-tile-2",
  "course-tile-3",
  "course-tile-4",
  "course-tile-5",
] as const;

/**
 * FNV-1a over a stable course field. Any hash would do; the requirement is that
 * it is pure, so a course does not change appearance between renders or between
 * the server and the client.
 */
function toneFor(seed: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return TILE_TONES[Math.abs(hash) % TILE_TONES.length]!;
}

/**
 * Resolve what a course card should show in its 16:9 slot.
 *
 * A real provider thumbnail wins when one exists. Otherwise the card gets a
 * branded tile — deliberately not artwork, since inventing course imagery would
 * misrepresent the provider. Tones are drawn from one restrained brand-adjacent
 * set so a grid of fallbacks looks curated rather than random.
 */
export function getCourseVisual(course: CourseWithProvider): CourseVisual {
  const remote = course.imageStorageUrl ?? course.imageSourceUrl ?? null;
  const shortTitle =
    course.title.length > 64 ? `${course.title.slice(0, 61)}…` : course.title;

  return {
    src: remote && /^https:\/\//i.test(remote) ? remote : null,
    eyebrow: course.provider?.name ?? "",
    title: shortTitle,
    toneClass: toneFor(course.slug || course.id || course.title),
  };
}
