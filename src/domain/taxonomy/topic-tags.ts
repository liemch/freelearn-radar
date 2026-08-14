import { and, asc, desc, eq, gte, notInArray, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  courseTopicTags,
  courses,
  providers,
  topicTags,
  type TopicTag,
} from "@/db/schema";
import { FREE_LIST_EXCLUDED_PRICE_TYPES } from "@/domain/course/free-durability";
import { courseAnalysisSchema } from "@/services/ai/ai-provider";
import { slugify } from "@/lib/slug";

const INDEXABLE_COURSE_COUNT = 8;

/**
 * Extract topic slugs from AI analysis JSON (categories array).
 * Returns unique, non-empty slugified values.
 */
export function extractTopicSlugsFromAnalysis(aiAnalysisJson: unknown): string[] {
  const parsed = courseAnalysisSchema.safeParse(aiAnalysisJson);
  if (!parsed.success) {
    return [];
  }

  const seen = new Set<string>();
  const slugs: string[] = [];

  for (const name of parsed.data.categories ?? []) {
    const slug = slugify(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }

  return slugs;
}

function displayNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function upsertTopicTag(
  db: Db,
  slug: string,
  categoryId?: string | null,
): Promise<TopicTag> {
  const existing = await db
    .select()
    .from(topicTags)
    .where(eq(topicTags.slug, slug))
    .limit(1);

  const row = existing[0];
  if (row) {
    if (categoryId && !row.categoryId) {
      const updated = await db
        .update(topicTags)
        .set({ categoryId, updatedAt: new Date() })
        .where(eq(topicTags.id, row.id))
        .returning();
      return updated[0] ?? row;
    }
    return row;
  }

  const name = displayNameFromSlug(slug);
  const inserted = await db
    .insert(topicTags)
    .values({
      slug,
      nameEn: name,
      nameVi: name,
      categoryId: categoryId ?? null,
      source: "ai_analysis",
      courseCount: 0,
      active: true,
    })
    .returning();

  const created = inserted[0];
  if (!created) {
    throw new Error(`Failed to create topic tag ${slug}`);
  }
  return created;
}

async function refreshCourseCounts(db: Db, tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;

  for (const tagId of tagIds) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(courseTopicTags)
      .where(eq(courseTopicTags.tagId, tagId));

    await db
      .update(topicTags)
      .set({ courseCount: count ?? 0, updatedAt: new Date() })
      .where(eq(topicTags.id, tagId));
  }
}

/**
 * Upsert topic tags from slugs, replace course↔tag joins, refresh courseCount.
 */
export async function syncCourseTopicTags(
  db: Db,
  courseId: string,
  slugs: string[],
  categoryId?: string | null,
): Promise<void> {
  const uniqueSlugs = [...new Set(slugs.map((s) => slugify(s)).filter(Boolean))];

  const previousJoins = await db
    .select({ tagId: courseTopicTags.tagId })
    .from(courseTopicTags)
    .where(eq(courseTopicTags.courseId, courseId));
  const previousTagIds = previousJoins.map((j) => j.tagId);

  await db
    .delete(courseTopicTags)
    .where(eq(courseTopicTags.courseId, courseId));

  const tags: TopicTag[] = [];
  for (const slug of uniqueSlugs) {
    tags.push(await upsertTopicTag(db, slug, categoryId));
  }

  if (tags.length > 0) {
    await db.insert(courseTopicTags).values(
      tags.map((tag) => ({
        courseId,
        tagId: tag.id,
        source: "ai_analysis",
      })),
    );
  }

  const affected = [...new Set([...previousTagIds, ...tags.map((t) => t.id)])];
  await refreshCourseCounts(db, affected);
}

/** Tags with enough courses to index publicly (and still active). */
export async function listIndexableTopicTags(db: Db): Promise<TopicTag[]> {
  return db
    .select()
    .from(topicTags)
    .where(
      and(
        eq(topicTags.active, true),
        gte(topicTags.courseCount, INDEXABLE_COURSE_COUNT),
      ),
    )
    .orderBy(desc(topicTags.courseCount), asc(topicTags.slug));
}

export async function listAllTopicTags(db: Db): Promise<TopicTag[]> {
  return db
    .select()
    .from(topicTags)
    .orderBy(desc(topicTags.courseCount), asc(topicTags.slug));
}

export async function findTopicTagBySlug(
  db: Db,
  slug: string,
): Promise<TopicTag | null> {
  const rows = await db
    .select()
    .from(topicTags)
    .where(eq(topicTags.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPublishedCoursesForTopicTag(
  db: Db,
  tagId: string,
  limit = 48,
) {
  return db
    .select({
      course: courses,
      provider: providers,
    })
    .from(courseTopicTags)
    .innerJoin(courses, eq(courseTopicTags.courseId, courses.id))
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .where(
      and(
        eq(courseTopicTags.tagId, tagId),
        eq(courses.status, "PUBLISHED"),
        // Topic pages are free-labelled surfaces (§66.4).
        notInArray(courses.priceType, [...FREE_LIST_EXCLUDED_PRICE_TYPES]),
      ),
    )
    .orderBy(desc(courses.qualityScore), desc(courses.publishedAt))
    .limit(limit);
}

export function isTopicPageIndexable(courseCount: number): boolean {
  return courseCount >= INDEXABLE_COURSE_COUNT;
}

export function canRenderTopicPage(
  featureEnabled: boolean,
  courseCount: number,
): boolean {
  return featureEnabled || courseCount >= INDEXABLE_COURSE_COUNT;
}

export const TOPIC_INDEX_THRESHOLD = INDEXABLE_COURSE_COUNT;
