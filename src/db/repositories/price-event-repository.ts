import { and, desc, eq, isNull } from "drizzle-orm";

import type { Db } from "@/db";
import {
  coursePriceEvents,
  type CoursePriceEvent,
  type NewCoursePriceEvent,
} from "@/db/schema";

export async function insertPriceEvent(
  db: Db,
  input: NewCoursePriceEvent,
): Promise<CoursePriceEvent> {
  const rows = await db.insert(coursePriceEvents).values(input).returning();
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to insert price event");
  }
  return row;
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
