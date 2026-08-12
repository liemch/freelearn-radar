import { desc, eq, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  categories,
  courseCategories,
  courses,
  outboundClicks,
  providers,
  type NewOutboundClick,
  type OutboundClick,
} from "@/db/schema";

export async function recordOutboundClick(
  db: Db,
  input: NewOutboundClick,
): Promise<OutboundClick> {
  const rows = await db.insert(outboundClicks).values(input).returning();
  const click = rows[0];
  if (!click) {
    throw new Error("Failed to record outbound click");
  }
  return click;
}

export async function listTopClickedCourses(db: Db, limit = 10) {
  return db
    .select({
      courseId: outboundClicks.courseId,
      title: courses.title,
      slug: courses.slug,
      clicks: sql<number>`count(*)::int`,
    })
    .from(outboundClicks)
    .innerJoin(courses, eq(outboundClicks.courseId, courses.id))
    .groupBy(outboundClicks.courseId, courses.title, courses.slug)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

export async function listTopClickedProviders(db: Db, limit = 10) {
  return db
    .select({
      providerId: outboundClicks.providerId,
      name: providers.name,
      slug: providers.slug,
      clicks: sql<number>`count(*)::int`,
    })
    .from(outboundClicks)
    .innerJoin(providers, eq(outboundClicks.providerId, providers.id))
    .groupBy(outboundClicks.providerId, providers.name, providers.slug)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

export async function listTopClickedCategories(db: Db, limit = 10) {
  return db
    .select({
      categoryId: categories.id,
      name: categories.name,
      slug: categories.slug,
      clicks: sql<number>`count(*)::int`,
    })
    .from(outboundClicks)
    .innerJoin(
      courseCategories,
      eq(outboundClicks.courseId, courseCategories.courseId),
    )
    .innerJoin(categories, eq(courseCategories.categoryId, categories.id))
    .groupBy(categories.id, categories.name, categories.slug)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}
