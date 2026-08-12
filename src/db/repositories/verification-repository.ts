import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  courseVerifications,
  type CourseVerification,
  type NewCourseVerification,
} from "@/db/schema";

export async function createVerification(
  db: Db,
  input: NewCourseVerification,
): Promise<CourseVerification> {
  const rows = await db.insert(courseVerifications).values(input).returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create verification");
  }
  return row;
}

export async function listVerificationsForCourse(
  db: Db,
  courseId: string,
  limit = 20,
): Promise<CourseVerification[]> {
  return db
    .select()
    .from(courseVerifications)
    .where(eq(courseVerifications.courseId, courseId))
    .orderBy(desc(courseVerifications.verifiedAt))
    .limit(limit);
}

export async function getLatestVerification(
  db: Db,
  courseId: string,
): Promise<CourseVerification | null> {
  const rows = await listVerificationsForCourse(db, courseId, 1);
  return rows[0] ?? null;
}

export async function listLatestVerificationByCourseIds(
  db: Db,
  courseIds: string[],
): Promise<Map<string, CourseVerification>> {
  const map = new Map<string, CourseVerification>();
  if (courseIds.length === 0) {
    return map;
  }

  // Distinct-on via ordered query; take first per course in JS for portability.
  const rows = await db
    .select()
    .from(courseVerifications)
    .where(inArray(courseVerifications.courseId, courseIds))
    .orderBy(desc(courseVerifications.verifiedAt));

  for (const row of rows) {
    if (!map.has(row.courseId)) {
      map.set(row.courseId, row);
    }
  }

  return map;
}

export async function countVerifications(
  db: Db,
  courseId: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(courseVerifications)
    .where(eq(courseVerifications.courseId, courseId));
  return rows[0]?.count ?? 0;
}

export async function listFailedRecentVerifications(
  db: Db,
  courseId: string,
): Promise<CourseVerification[]> {
  return db
    .select()
    .from(courseVerifications)
    .where(
      and(
        eq(courseVerifications.courseId, courseId),
        eq(courseVerifications.status, "FAILED"),
      ),
    )
    .orderBy(desc(courseVerifications.verifiedAt))
    .limit(5);
}
