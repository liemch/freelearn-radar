import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  courseObservations,
  courses,
  type CourseObservation,
  type NewCourseObservation,
} from "@/db/schema";

/** Append-only insert — never update or delete observations. */
export async function insertObservation(
  db: Db,
  input: NewCourseObservation,
): Promise<CourseObservation> {
  const rows = await db.insert(courseObservations).values(input).returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to insert observation");
  }
  return row;
}

export async function listRecentObservations(
  db: Db,
  courseId: string,
  limit = 20,
): Promise<CourseObservation[]> {
  return db
    .select()
    .from(courseObservations)
    .where(eq(courseObservations.courseId, courseId))
    .orderBy(desc(courseObservations.observedAt))
    .limit(limit);
}

export async function listRecentOkObservations(
  db: Db,
  courseId: string,
  limit = 3,
): Promise<CourseObservation[]> {
  return db
    .select()
    .from(courseObservations)
    .where(
      and(
        eq(courseObservations.courseId, courseId),
        eq(courseObservations.fetchStatus, "OK"),
      ),
    )
    .orderBy(desc(courseObservations.observedAt))
    .limit(limit);
}

/**
 * Share of observations with fetch_status = BLOCKED since `since`.
 * Optionally scoped to courses of a provider.
 */
export async function countBlockedRate(
  db: Db,
  providerId?: string,
  since?: Date,
): Promise<{ total: number; blocked: number; rate: number }> {
  if (providerId) {
    const conditions = [eq(courses.providerId, providerId)];
    if (since) {
      conditions.push(gte(courseObservations.observedAt, since));
    }

    const rows = await db
      .select({
        total: sql<number>`count(*)::int`,
        blocked: sql<number>`count(*) filter (where ${courseObservations.fetchStatus} = 'BLOCKED')::int`,
      })
      .from(courseObservations)
      .innerJoin(courses, eq(courses.id, courseObservations.courseId))
      .where(and(...conditions));

    const total = rows[0]?.total ?? 0;
    const blocked = rows[0]?.blocked ?? 0;
    return {
      total,
      blocked,
      rate: total === 0 ? 0 : blocked / total,
    };
  }

  if (since) {
    const rows = await db
      .select({
        total: sql<number>`count(*)::int`,
        blocked: sql<number>`count(*) filter (where ${courseObservations.fetchStatus} = 'BLOCKED')::int`,
      })
      .from(courseObservations)
      .where(gte(courseObservations.observedAt, since));

    const total = rows[0]?.total ?? 0;
    const blocked = rows[0]?.blocked ?? 0;
    return {
      total,
      blocked,
      rate: total === 0 ? 0 : blocked / total,
    };
  }

  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      blocked: sql<number>`count(*) filter (where ${courseObservations.fetchStatus} = 'BLOCKED')::int`,
    })
    .from(courseObservations);

  const total = rows[0]?.total ?? 0;
  const blocked = rows[0]?.blocked ?? 0;
  return {
    total,
    blocked,
    rate: total === 0 ? 0 : blocked / total,
  };
}
