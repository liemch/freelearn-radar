import { and, desc, eq, isNull } from "drizzle-orm";

import type { Db } from "@/db";
import {
  coursePriceEvents,
  type CoursePriceEvent,
  type NewCoursePriceEvent,
} from "@/db/schema";

/**
 * Returns null when a concurrent run already recorded the same transition for the
 * same course on the same day. The partial unique index (migration 0006) is what
 * makes that safe: the application-level cooldown check is a SELECT followed by an
 * INSERT, so two workers can both pass it before either commits.
 */
export async function insertPriceEvent(
  db: Db,
  input: NewCoursePriceEvent,
): Promise<CoursePriceEvent | null> {
  const rows = await db
    .insert(coursePriceEvents)
    .values(input)
    .onConflictDoNothing()
    .returning();

  return rows[0] ?? null;
}

export async function listUnconfirmed(
  db: Db,
  options?: { courseId?: string; limit?: number },
): Promise<CoursePriceEvent[]> {
  const conditions = [isNull(coursePriceEvents.confirmedAt)];
  if (options?.courseId) {
    conditions.push(eq(coursePriceEvents.courseId, options.courseId));
  }

  return db
    .select()
    .from(coursePriceEvents)
    .where(and(...conditions))
    .orderBy(desc(coursePriceEvents.createdAt))
    .limit(options?.limit ?? 50);
}

export async function listRecentPublic(
  db: Db,
  options?: { courseId?: string; limit?: number },
): Promise<CoursePriceEvent[]> {
  const conditions = [eq(coursePriceEvents.isPublic, true)];
  if (options?.courseId) {
    conditions.push(eq(coursePriceEvents.courseId, options.courseId));
  }

  return db
    .select()
    .from(coursePriceEvents)
    .where(and(...conditions))
    .orderBy(desc(coursePriceEvents.confirmedAt), desc(coursePriceEvents.createdAt))
    .limit(options?.limit ?? 50);
}

export async function listRecentEventsForCourse(
  db: Db,
  courseId: string,
  limit = 10,
): Promise<CoursePriceEvent[]> {
  return db
    .select()
    .from(coursePriceEvents)
    .where(eq(coursePriceEvents.courseId, courseId))
    .orderBy(desc(coursePriceEvents.createdAt))
    .limit(limit);
}
