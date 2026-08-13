import {
  and,
  desc,
  eq,
  ilike,
  isNotNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Db } from "@/db";
import {
  categories,
  courseCategories,
  courses,
  providers,
  type Category,
  type Course,
  type NewCourse,
  type Provider,
} from "@/db/schema";
import type { CatalogFilters, CatalogSort } from "@/domain/course/catalog-query";
import { DEFAULT_PAGE_SIZE } from "@/domain/course/catalog-query";
import type { CourseStatus } from "@/domain/course/types";

export type CourseWithProvider = Course & {
  provider: Provider;
};

export type CourseDetail = CourseWithProvider & {
  categories: Category[];
};

export type CatalogResult = {
  items: CourseWithProvider[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Postgres orders DESC as NULLS FIRST by default, which would float unscored courses
 * to the top of every catalog page. Every sort is explicitly NULLS LAST with a
 * deterministic tiebreaker so pagination is stable.
 */
export function sortExpression(sort: CatalogSort = "recommended"): SQL[] {
  switch (sort) {
    case "newest":
      return [
        sql`${courses.publishedAt} DESC NULLS LAST`,
        sql`${courses.createdAt} DESC`,
      ];
    case "shortest":
      return [
        sql`${courses.durationMinutes} ASC NULLS LAST`,
        sql`${courses.title} ASC`,
      ];
    case "popular":
      return [
        sql`${courses.ratingCount} DESC NULLS LAST`,
        sql`${courses.qualityScore} DESC NULLS LAST`,
        sql`${courses.publishedAt} DESC NULLS LAST`,
      ];
    case "recommended":
    default:
      return [
        sql`${courses.qualityScore} DESC NULLS LAST`,
        sql`${courses.lastVerifiedAt} DESC NULLS LAST`,
        sql`${courses.publishedAt} DESC NULLS LAST`,
      ];
  }
}

export function buildCatalogConditions(
  filters: CatalogFilters,
  options?: { categorySlug?: string; publishedOnly?: boolean },
): SQL[] {
  const conditions: SQL[] = [];
  const publishedOnly = options?.publishedOnly ?? true;

  if (publishedOnly) {
    conditions.push(eq(courses.status, "PUBLISHED"));
  }

  if (filters.q) {
    // Escape LIKE wildcards so a query of "%" does not match the whole catalog.
    const pattern = `%${filters.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    conditions.push(
      or(
        ilike(courses.title, pattern),
        ilike(courses.description, pattern),
        ilike(courses.shortDescription, pattern),
        ilike(providers.name, pattern),
        // Project plan §26 lists categories as a search field.
        sql`exists (
          select 1
          from ${courseCategories} sc
          join ${categories} scat on scat.id = sc.category_id
          where sc.course_id = ${courses.id} and scat.name ilike ${pattern}
        )`,
      )!,
    );
  }

  if (filters.providerSlug) {
    conditions.push(eq(providers.slug, filters.providerSlug));
  }

  if (filters.level) {
    conditions.push(eq(courses.level, filters.level));
  }

  if (filters.language) {
    conditions.push(eq(courses.language, filters.language));
  }

  if (filters.certificateType) {
    conditions.push(eq(courses.certificateType, filters.certificateType));
  }

  if (filters.priceType) {
    conditions.push(eq(courses.priceType, filters.priceType));
  }

  if (filters.durationMaxMinutes != null) {
    conditions.push(
      and(
        isNotNull(courses.durationMinutes),
        sql`${courses.durationMinutes} <= ${filters.durationMaxMinutes}`,
      )!,
    );
  }

  if (options?.categorySlug) {
    conditions.push(eq(categories.slug, options.categorySlug));
  }

  return conditions;
}

export async function findCourseById(
  db: Db,
  id: string,
): Promise<Course | null> {
  const rows = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  return rows[0] ?? null;
}

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

export async function getCourseDetailBySlug(
  db: Db,
  slug: string,
): Promise<CourseDetail | null> {
  const rows = await db
    .select({
      course: courses,
      provider: providers,
    })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .where(eq(courses.slug, slug))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const categoryRows = await db
    .select({ category: categories })
    .from(courseCategories)
    .innerJoin(categories, eq(courseCategories.categoryId, categories.id))
    .where(eq(courseCategories.courseId, row.course.id));

  return {
    ...row.course,
    provider: row.provider,
    categories: categoryRows.map((item) => item.category),
  };
}

export async function createCourse(db: Db, input: NewCourse): Promise<Course> {
  const rows = await db.insert(courses).values(input).returning();
  const course = rows[0];

  if (!course) {
    throw new Error("Failed to create course");
  }

  return course;
}

export async function updateCourse(
  db: Db,
  id: string,
  input: Partial<NewCourse>,
): Promise<Course> {
  const rows = await db
    .update(courses)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, id))
    .returning();

  const course = rows[0];
  if (!course) {
    throw new Error("Course not found");
  }

  return course;
}

export async function listCourses(
  db: Db,
  options?: { status?: CourseStatus; limit?: number },
): Promise<CourseWithProvider[]> {
  const conditions: SQL[] = [];

  if (options?.status) {
    conditions.push(eq(courses.status, options.status));
  }

  const query = db
    .select({
      course: courses,
      provider: providers,
    })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .orderBy(desc(courses.updatedAt))
    .limit(options?.limit ?? 100);

  const rows =
    conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

  return rows.map((row) => ({
    ...row.course,
    provider: row.provider,
  }));
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

export async function listPublishedCoursesWithProvider(
  db: Db,
  limit = 20,
): Promise<CourseWithProvider[]> {
  const rows = await db
    .select({
      course: courses,
      provider: providers,
    })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .where(eq(courses.status, "PUBLISHED"))
    .orderBy(desc(courses.publishedAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row.course,
    provider: row.provider,
  }));
}

export async function listBestCourses(
  db: Db,
  limit = 8,
): Promise<CourseWithProvider[]> {
  const rows = await db
    .select({
      course: courses,
      provider: providers,
    })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .where(and(eq(courses.status, "PUBLISHED"), isNotNull(courses.qualityScore)))
    .orderBy(desc(courses.qualityScore))
    .limit(limit);

  return rows.map((row) => ({
    ...row.course,
    provider: row.provider,
  }));
}

export async function listCoursesByCategorySlug(
  db: Db,
  categorySlug: string,
  limit = 8,
): Promise<CourseWithProvider[]> {
  const rows = await db
    .select({
      course: courses,
      provider: providers,
    })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .innerJoin(courseCategories, eq(courseCategories.courseId, courses.id))
    .innerJoin(categories, eq(courseCategories.categoryId, categories.id))
    .where(and(eq(courses.status, "PUBLISHED"), eq(categories.slug, categorySlug)))
    .orderBy(desc(courses.qualityScore))
    .limit(limit);

  return rows.map((row) => ({
    ...row.course,
    provider: row.provider,
  }));
}

export async function queryCatalog(
  db: Db,
  filters: CatalogFilters,
  options?: { categorySlug?: string },
): Promise<CatalogResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const conditions = buildCatalogConditions(filters, options);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const baseFrom = db
    .select({
      course: courses,
      provider: providers,
    })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id));

  const joined =
    options?.categorySlug != null
      ? baseFrom
          .innerJoin(courseCategories, eq(courseCategories.courseId, courses.id))
          .innerJoin(categories, eq(courseCategories.categoryId, categories.id))
      : baseFrom;

  const countBase = db
    .select({ count: sql<number>`count(distinct ${courses.id})::int` })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id));

  const countJoined =
    options?.categorySlug != null
      ? countBase
          .innerJoin(courseCategories, eq(courseCategories.courseId, courses.id))
          .innerJoin(categories, eq(courseCategories.categoryId, categories.id))
      : countBase;

  const [countRows, itemRows] = await Promise.all([
    whereClause ? countJoined.where(whereClause) : countJoined,
    (whereClause ? joined.where(whereClause) : joined)
      .orderBy(...sortExpression(filters.sort))
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = countRows[0]?.count ?? 0;

  return {
    items: itemRows.map((row) => ({
      ...row.course,
      provider: row.provider,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
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

export async function getCourseCategoryIds(
  db: Db,
  courseId: string,
): Promise<string[]> {
  const rows = await db
    .select({ categoryId: courseCategories.categoryId })
    .from(courseCategories)
    .where(eq(courseCategories.courseId, courseId));

  return rows.map((row) => row.categoryId);
}

export async function findRelatedCourses(
  db: Db,
  courseId: string,
  categoryIds: string[],
  limit = 4,
): Promise<CourseWithProvider[]> {
  // Compatibility wrapper — prefer listRelatedCoursesFor when source fields available.
  return listRelatedCoursesFor(
    db,
    {
      id: courseId,
      providerId: "",
      level: "UNKNOWN",
      language: null,
      priceType: "UNKNOWN",
      categoryIds,
    },
    limit,
  );
}

export async function listRelatedCoursesFor(
  db: Db,
  source: {
    id: string;
    providerId: string;
    level: string;
    language: string | null;
    priceType: string;
    categoryIds: string[];
  },
  limit = 4,
): Promise<CourseWithProvider[]> {
  const poolLimit = Math.max(limit * 10, 30);
  const rows = await db
    .select({
      course: courses,
      provider: providers,
      categoryId: courseCategories.categoryId,
    })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .leftJoin(courseCategories, eq(courseCategories.courseId, courses.id))
    .where(and(eq(courses.status, "PUBLISHED"), sql`${courses.id} <> ${source.id}`))
    .orderBy(desc(courses.qualityScore))
    .limit(poolLimit * 3);

  const byId = new Map<string, CourseWithProvider & { categoryIds: string[] }>();
  for (const row of rows) {
    const existing = byId.get(row.course.id);
    if (existing) {
      if (row.categoryId) existing.categoryIds.push(row.categoryId);
    } else {
      byId.set(row.course.id, {
        ...row.course,
        provider: row.provider,
        categoryIds: row.categoryId ? [row.categoryId] : [],
      });
    }
  }

  const { selectRelatedCourses } = await import(
    "@/domain/discovery/related-courses"
  );

  return selectRelatedCourses(
    source,
    Array.from(byId.values()),
    limit,
  );
}

export async function listCoursesByProviderSlug(
  db: Db,
  providerSlug: string,
  limit = 24,
): Promise<CourseWithProvider[]> {
  const rows = await db
    .select({
      course: courses,
      provider: providers,
    })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .where(
      and(eq(courses.status, "PUBLISHED"), eq(providers.slug, providerSlug)),
    )
    .orderBy(desc(courses.lastVerifiedAt), desc(courses.qualityScore))
    .limit(limit);

  return rows.map((row) => ({
    ...row.course,
    provider: row.provider,
  }));
}

export async function countPublishedByProviderSlug(
  db: Db,
  providerSlug: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .where(
      and(eq(courses.status, "PUBLISHED"), eq(providers.slug, providerSlug)),
    );
  return rows[0]?.count ?? 0;
}
