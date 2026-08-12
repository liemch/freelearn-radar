import type { Db } from "@/db";
import { findCandidateByCanonicalUrl } from "@/db/repositories/candidate-repository";
import { findCourseByCanonicalUrl } from "@/db/repositories/course-repository";
import { suggestSoftDuplicate } from "@/domain/quality/title-similarity";

export type DuplicateCheckResult =
  | { duplicate: false }
  | {
      duplicate: true;
      reason: "CANDIDATE" | "COURSE";
      existingId: string;
    };

export async function detectDuplicate(
  db: Db,
  canonicalUrl: string,
): Promise<DuplicateCheckResult> {
  const existingCandidate = await findCandidateByCanonicalUrl(db, canonicalUrl);
  if (existingCandidate) {
    return {
      duplicate: true,
      reason: "CANDIDATE",
      existingId: existingCandidate.id,
    };
  }

  const existingCourse = await findCourseByCanonicalUrl(db, canonicalUrl);
  if (existingCourse) {
    return {
      duplicate: true,
      reason: "COURSE",
      existingId: existingCourse.id,
    };
  }

  return { duplicate: false };
}

/** Soft duplicate hint for admin tooling — never auto-merges. */
export function evaluateSoftDuplicateHint(input: {
  titleA: string;
  titleB: string;
  providerA?: string | null;
  providerB?: string | null;
}) {
  return suggestSoftDuplicate(input);
}
