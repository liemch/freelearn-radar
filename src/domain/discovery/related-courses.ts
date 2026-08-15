import type { CourseWithProvider } from "@/db/repositories/course-repository";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import { estimateTrustStateForCourse } from "@/domain/ranking/ranking";

export type RelatedCourseInput = CourseWithProvider & {
  categoryIds?: string[];
};

/**
 * Deterministic related-course ranking (no AI).
 * Signals: shared categories, same provider, level, language, free type.
 */
export function selectRelatedCourses(
  source: {
    id: string;
    providerId: string;
    level: string;
    language: string | null;
    priceType: string;
    categoryIds: string[];
  },
  candidates: RelatedCourseInput[],
  limit = 4,
  now = new Date(),
): CourseWithProvider[] {
  const scored = candidates
    .filter((course) => course.id !== source.id)
    .filter((course) => course.status === "PUBLISHED")
    // Truth decides eligibility, ranking only decides order (§90.2).
    .filter((course) => isEligibleForFreeLists(course.priceType))
    .map((course) => {
      const trust = estimateTrustStateForCourse(
        { ...course, providerName: course.provider?.name },
        now,
      );
      if (trust === "UNVERIFIED" || trust === "STALE") {
        // Keep but penalize heavily
      }

      let score = 0;
      const sharedCategories = (course.categoryIds ?? []).filter((id) =>
        source.categoryIds.includes(id),
      ).length;
      score += sharedCategories * 40;
      if (course.providerId === source.providerId) score += 15;
      if (course.level === source.level && source.level !== "UNKNOWN") score += 10;
      if (
        course.language &&
        source.language &&
        course.language.toLowerCase() === source.language.toLowerCase()
      ) {
        score += 8;
      }
      if (course.priceType === source.priceType) score += 5;
      score += (course.qualityScore ?? 40) * 0.2;

      if (trust === "STALE" || trust === "UNVERIFIED") score *= 0.6;
      if (trust === "NEEDS_REVIEW") score *= 0.75;

      return { course, score };
    })
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const results: CourseWithProvider[] = [];
  for (const item of scored) {
    if (seen.has(item.course.id)) continue;
    seen.add(item.course.id);
    results.push(item.course);
    if (results.length >= limit) break;
  }
  return results;
}
