import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  courseCategories,
  courses,
  type Course,
  type NewCourse,
} from "@/db/schema";
import type { CourseStatus } from "@/domain/course/types";

export async function findCourseBySlug(
  db: Db,
  slug: string,
): Promise<Course | null> {
  const rows = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);

  return rows[0] ?? null;
}

export async function findCourseByCanonicalUrl(
  db: Db,
  canonicalUrl: string,
): Promise<Course | null> {
  const rows = await db
    .select()
    .from(courses)
    .where(eq(courses.canonicalUrl, canonicalUrl))
    .limit(1);

  return rows[0] ?? null;
}

export async function createCourse(db: Db, input: NewCourse): Promise<Course> {
  const rows = await db.insert(courses).values(input).returning();
  const course = rows[0];

  if (!course) {
    throw new Error("Failed to create course");
  }

  return course;
}

export async function listPublishedCourses(
  db: Db,
  limit = 20,
  offset = 0,
): Promise<Course[]> {
  return db
    .select()
    .from(courses)
    .where(eq(courses.status, "PUBLISHED"))
    .orderBy(desc(courses.publishedAt))
    .limit(limit)
    .offset(offset);
}

export async function countCoursesByStatus(
  db: Db,
  status: CourseStatus,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(courses)
    .where(eq(courses.status, status));

  return rows[0]?.count ?? 0;
}

export async function searchCourses(
  db: Db,
  query: string,
  limit = 20,
): Promise<Course[]> {
  const pattern = `%${query.trim()}%`;

  return db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.status, "PUBLISHED"),
        or(
          ilike(courses.title, pattern),
          ilike(courses.description, pattern),
          ilike(courses.shortDescription, pattern),
        ),
      ),
    )
    .orderBy(desc(courses.publishedAt))
    .limit(limit);
}

export async function setCourseCategories(
  db: Db,
  courseId: string,
  categoryIds: string[],
) {
  await db
    .delete(courseCategories)
    .where(eq(courseCategories.courseId, courseId));

  if (categoryIds.length === 0) {
    return;
  }

  await db.insert(courseCategories).values(
    categoryIds.map((categoryId) => ({
      courseId,
      categoryId,
    })),
  );
}
