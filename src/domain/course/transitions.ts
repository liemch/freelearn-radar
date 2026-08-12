import type { CourseStatus, DiscoveryStatus } from "@/domain/course/types";

const APPROVABLE_CANDIDATE_STATUSES: ReadonlySet<DiscoveryStatus> = new Set([
  "READY_FOR_REVIEW",
  "ANALYZED",
]);

const REJECTABLE_CANDIDATE_STATUSES: ReadonlySet<DiscoveryStatus> = new Set([
  "DISCOVERED",
  "FETCHED",
  "ANALYZED",
  "READY_FOR_REVIEW",
  "ERROR",
]);

/** Allowed course status transitions (source → targets). */
const COURSE_TRANSITIONS: Record<CourseStatus, ReadonlySet<CourseStatus>> = {
  DRAFT: new Set(["PUBLISHED", "ARCHIVED"]),
  PUBLISHED: new Set(["DRAFT", "EXPIRED", "UNAVAILABLE", "ARCHIVED"]),
  EXPIRED: new Set(["PUBLISHED", "ARCHIVED", "UNAVAILABLE"]),
  UNAVAILABLE: new Set(["PUBLISHED", "ARCHIVED", "EXPIRED"]),
  ARCHIVED: new Set(["DRAFT"]),
};

export function canApproveCandidate(status: DiscoveryStatus): boolean {
  return APPROVABLE_CANDIDATE_STATUSES.has(status);
}

export function canRejectCandidate(status: DiscoveryStatus): boolean {
  return REJECTABLE_CANDIDATE_STATUSES.has(status);
}

export function canTransitionCourseStatus(
  from: CourseStatus,
  to: CourseStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return COURSE_TRANSITIONS[from]?.has(to) ?? false;
}

export function assertCourseStatusTransition(
  from: CourseStatus,
  to: CourseStatus,
): void {
  if (!canTransitionCourseStatus(from, to)) {
    throw new Error(`Invalid course status transition: ${from} → ${to}`);
  }
}
