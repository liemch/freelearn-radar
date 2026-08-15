import { and, eq, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { affiliateClicks } from "@/db/schema/affiliate";
import { affiliateProductContexts } from "@/db/schema/affiliate-products";
import { courseEmbeddings } from "@/db/schema/course-embeddings";
import { courseObservations } from "@/db/schema/course-observations";
import { courseOffers } from "@/db/schema/coupon";
import { courseVerifications } from "@/db/schema/course-verifications";
import { courseWatches } from "@/db/schema/course-watches";
import { courses } from "@/db/schema/courses";
import { outboundClicks } from "@/db/schema/outbound-clicks";
import { assertCourseStatusTransition } from "@/domain/course/transitions";
import type { CourseStatus } from "@/domain/course/types";

export type PurgeClassification =
  | "SAFE_TO_PURGE"
  | "PURGE_WITH_SAFE_CASCADE"
  | "BLOCKED_BY_HISTORY";

export type CourseDependencySnapshot = {
  outboundClicks: number;
  observations: number;
  verifications: number;
  offers: number;
  watches: number;
  embeddings: number;
  affiliateClicks: number;
  productContexts: number;
  publishedAt: Date | null;
  status: CourseStatus;
};

async function countWhereCourseId(
  db: Db,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: any,
  courseId: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(eq(column, courseId));
  return rows[0]?.count ?? 0;
}

export async function snapshotCourseDependencies(
  db: Db,
  courseId: string,
): Promise<CourseDependencySnapshot | null> {
  const courseRows = await db
    .select({
      status: courses.status,
      publishedAt: courses.publishedAt,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const course = courseRows[0];
  if (!course) return null;

  const [
    outbound,
    observations,
    verifications,
    offers,
    watches,
    embeddings,
    affClicks,
    contexts,
  ] = await Promise.all([
    countWhereCourseId(db, outboundClicks, outboundClicks.courseId, courseId),
    countWhereCourseId(
      db,
      courseObservations,
      courseObservations.courseId,
      courseId,
    ),
    countWhereCourseId(
      db,
      courseVerifications,
      courseVerifications.courseId,
      courseId,
    ),
    countWhereCourseId(db, courseOffers, courseOffers.courseId, courseId),
    countWhereCourseId(db, courseWatches, courseWatches.courseId, courseId),
    countWhereCourseId(
      db,
      courseEmbeddings,
      courseEmbeddings.courseId,
      courseId,
    ),
    countWhereCourseId(db, affiliateClicks, affiliateClicks.courseId, courseId),
    countWhereCourseId(
      db,
      affiliateProductContexts,
      affiliateProductContexts.courseId,
      courseId,
    ),
  ]);

  return {
    outboundClicks: outbound,
    observations,
    verifications,
    offers,
    watches,
    embeddings,
    affiliateClicks: affClicks,
    productContexts: contexts,
    publishedAt: course.publishedAt,
    status: course.status,
  };
}

export function classifyPurge(
  deps: CourseDependencySnapshot,
): PurgeClassification {
  if (
    deps.outboundClicks > 0 ||
    deps.watches > 0 ||
    deps.affiliateClicks > 0 ||
    (deps.publishedAt && deps.observations > 5) ||
    deps.offers > 0
  ) {
    return "BLOCKED_BY_HISTORY";
  }

  if (
    deps.verifications > 0 ||
    deps.observations > 0 ||
    deps.embeddings > 0 ||
    deps.productContexts > 0
  ) {
    return "PURGE_WITH_SAFE_CASCADE";
  }

  return "SAFE_TO_PURGE";
}

export async function restoreCourse(db: Db, courseId: string): Promise<void> {
  const rows = await db
    .select({ status: courses.status })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const current = rows[0];
  if (!current) throw new Error("Course not found");
  assertCourseStatusTransition(current.status, "DRAFT");
  await db
    .update(courses)
    .set({ status: "DRAFT", updatedAt: new Date() })
    .where(eq(courses.id, courseId));
}

export async function markCourseDuplicate(
  db: Db,
  input: { courseId: string; canonicalCourseId: string },
): Promise<void> {
  if (input.courseId === input.canonicalCourseId) {
    throw new Error("Không thể đánh dấu khóa học trùng với chính nó.");
  }

  const [target, canonical] = await Promise.all([
    db
      .select({ id: courses.id, status: courses.status })
      .from(courses)
      .where(eq(courses.id, input.courseId))
      .limit(1),
    db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, input.canonicalCourseId))
      .limit(1),
  ]);

  if (!target[0] || !canonical[0]) {
    throw new Error("Không tìm thấy khóa học.");
  }

  assertCourseStatusTransition(target[0].status, "ARCHIVED");

  await db
    .update(courses)
    .set({
      duplicateOfCourseId: input.canonicalCourseId,
      status: "ARCHIVED",
      updatedAt: new Date(),
    })
    .where(eq(courses.id, input.courseId));
}

export async function purgeCourse(
  db: Db,
  input: {
    courseId: string;
    confirmSlug: string;
    reason: string;
    allowCascade?: boolean;
  },
): Promise<{ classification: PurgeClassification }> {
  const rows = await db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      status: courses.status,
    })
    .from(courses)
    .where(eq(courses.id, input.courseId))
    .limit(1);
  const course = rows[0];
  if (!course) throw new Error("Course not found");

  if (course.status !== "ARCHIVED") {
    throw new Error("Chỉ được xóa vĩnh viễn khóa học đã lưu trữ.");
  }

  if (
    input.confirmSlug.trim() !== course.slug &&
    input.confirmSlug.trim() !== course.title
  ) {
    throw new Error("Xác nhận slug/tiêu đề không khớp.");
  }

  if (!input.reason.trim() || input.reason.trim().length < 8) {
    throw new Error("Cần lý do xóa (tối thiểu 8 ký tự).");
  }

  const deps = await snapshotCourseDependencies(db, input.courseId);
  if (!deps) throw new Error("Course not found");
  const classification = classifyPurge(deps);

  if (classification === "BLOCKED_BY_HISTORY") {
    throw new Error(
      "Khóa học có lịch sử người dùng/offer — hãy giữ ở trạng thái Lưu trữ.",
    );
  }

  if (classification === "PURGE_WITH_SAFE_CASCADE" && !input.allowCascade) {
    throw new Error(
      "Khóa học còn dữ liệu phụ thuộc. Xác nhận cascade an toàn để tiếp tục.",
    );
  }

  await db
    .update(courses)
    .set({ duplicateOfCourseId: null })
    .where(eq(courses.duplicateOfCourseId, input.courseId));

  await db.delete(courses).where(and(eq(courses.id, input.courseId)));

  return { classification };
}

export function courseEligibleForCouponRecheck(status: CourseStatus): boolean {
  return status === "PUBLISHED";
}
