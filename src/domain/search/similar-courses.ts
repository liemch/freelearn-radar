import { searchThresholds } from "@/config/search-thresholds";
import type { CourseWithProvider } from "@/db/repositories/course-repository";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import {
  selectRelatedCourses,
  type RelatedCourseInput,
} from "@/domain/discovery/related-courses";

export type SimilarCoursesOptions = {
  maxPerProvider?: number;
  now?: Date;
};

/**
 * Related-course ranking plus provider diversity (plan §93.2):
 * at most `maxPerProvider` courses per provider in the returned list,
 * and never a price type excluded from free surfaces.
 */
export function selectSimilarCourses(
  source: {
    id: string;
    providerId: string;
    level: string;
    language: string | null;
    priceType: string;
    categoryIds: string[];
  },
  candidates: RelatedCourseInput[],
  limit = 6,
  options?: SimilarCoursesOptions,
): CourseWithProvider[] {
  const maxPerProvider =
    options?.maxPerProvider ?? searchThresholds.diversityCapSimilarCourses;

  const ranked = selectRelatedCourses(
    source,
    candidates,
    candidates.length,
    options?.now ?? new Date(),
  );

  const perProvider = new Map<string, number>();
  const results: CourseWithProvider[] = [];
  for (const course of ranked) {
    if (!isEligibleForFreeLists(course.priceType)) continue;
    const count = perProvider.get(course.providerId) ?? 0;
    if (count >= maxPerProvider) continue;
    perProvider.set(course.providerId, count + 1);
    results.push(course);
    if (results.length >= limit) break;
  }

  return results;
}
