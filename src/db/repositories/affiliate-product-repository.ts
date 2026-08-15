import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
  type SQL,
} from "drizzle-orm";

import type { Db } from "@/db";
import {
  affiliateProductContexts,
  affiliateProducts,
  affiliateProviders,
  courses,
  type NewAffiliateProduct,
  type NewAffiliateProductContext,
} from "@/db/schema";

export async function listAffiliateProducts(
  db: Db,
  input: { query?: string; merchant?: "SHOPEE" | "LAZADA"; limit?: number } = {},
) {
  const conditions: SQL[] = [];
  if (input.query?.trim()) {
    conditions.push(ilike(affiliateProducts.title, `%${input.query.trim()}%`));
  }
  if (input.merchant) {
    conditions.push(eq(affiliateProducts.merchant, input.merchant));
  }

  return db
    .select()
    .from(affiliateProducts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(affiliateProducts.updatedAt))
    .limit(input.limit ?? 200);
}

export async function findAffiliateProductById(db: Db, id: string) {
  const rows = await db
    .select({
      product: affiliateProducts,
      provider: affiliateProviders,
    })
    .from(affiliateProducts)
    .leftJoin(
      affiliateProviders,
      eq(affiliateProducts.affiliateProviderId, affiliateProviders.id),
    )
    .where(eq(affiliateProducts.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAffiliateProductContexts(db: Db, productId: string) {
  return db
    .select({
      context: affiliateProductContexts,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(affiliateProductContexts)
    .leftJoin(courses, eq(affiliateProductContexts.courseId, courses.id))
    .where(eq(affiliateProductContexts.productId, productId))
    .orderBy(asc(affiliateProductContexts.priority));
}

export async function createAffiliateProduct(
  db: Db,
  input: NewAffiliateProduct,
) {
  const rows = await db.insert(affiliateProducts).values(input).returning();
  return rows[0];
}

export async function updateAffiliateProduct(
  db: Db,
  id: string,
  input: Partial<NewAffiliateProduct>,
) {
  const rows = await db
    .update(affiliateProducts)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(affiliateProducts.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteAffiliateProduct(db: Db, id: string) {
  const rows = await db
    .delete(affiliateProducts)
    .where(eq(affiliateProducts.id, id))
    .returning({ id: affiliateProducts.id });
  return rows[0] ?? null;
}

export async function createAffiliateProductContext(
  db: Db,
  input: NewAffiliateProductContext,
) {
  const rows = await db
    .insert(affiliateProductContexts)
    .values(input)
    .returning();
  return rows[0];
}

export async function deleteAffiliateProductContext(
  db: Db,
  productId: string,
  contextId: string,
) {
  const rows = await db
    .delete(affiliateProductContexts)
    .where(
      and(
        eq(affiliateProductContexts.id, contextId),
        eq(affiliateProductContexts.productId, productId),
      ),
    )
    .returning({ id: affiliateProductContexts.id });
  return rows[0] ?? null;
}

export async function listActiveAffiliateProductsForContext(
  db: Db,
  input: {
    placementKey: string;
    courseId?: string | null;
    topicSlug?: string | null;
    categorySlug?: string | null;
    now?: Date;
    limit?: number;
  },
) {
  const now = input.now ?? new Date();
  return db
    .select({
      product: affiliateProducts,
      context: affiliateProductContexts,
      provider: affiliateProviders,
    })
    .from(affiliateProductContexts)
    .innerJoin(
      affiliateProducts,
      eq(affiliateProductContexts.productId, affiliateProducts.id),
    )
    .leftJoin(
      affiliateProviders,
      eq(affiliateProducts.affiliateProviderId, affiliateProviders.id),
    )
    .where(
      and(
        eq(affiliateProductContexts.placementKey, input.placementKey),
        eq(affiliateProductContexts.enabled, true),
        eq(affiliateProducts.status, "ACTIVE"),
        or(isNull(affiliateProducts.startsAt), lte(affiliateProducts.startsAt, now)),
        or(isNull(affiliateProducts.endsAt), gte(affiliateProducts.endsAt, now)),
        input.courseId
          ? or(
              isNull(affiliateProductContexts.courseId),
              eq(affiliateProductContexts.courseId, input.courseId),
            )
          : isNull(affiliateProductContexts.courseId),
        input.topicSlug
          ? or(
              isNull(affiliateProductContexts.topicSlug),
              eq(affiliateProductContexts.topicSlug, input.topicSlug),
            )
          : isNull(affiliateProductContexts.topicSlug),
        input.categorySlug
          ? or(
              isNull(affiliateProductContexts.categorySlug),
              eq(affiliateProductContexts.categorySlug, input.categorySlug),
            )
          : isNull(affiliateProductContexts.categorySlug),
      ),
    )
    // Priority is editorial only. Commission/revenue is deliberately absent.
    .orderBy(asc(affiliateProductContexts.priority), desc(affiliateProducts.updatedAt))
    .limit(input.limit ?? 3);
}
