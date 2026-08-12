import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import { categories, type Category, type NewCategory } from "@/db/schema";

export async function listCategories(db: Db): Promise<Category[]> {
  return db.select().from(categories);
}

export async function findCategoryBySlug(
  db: Db,
  slug: string,
): Promise<Category | null> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  return rows[0] ?? null;
}

export async function createCategory(
  db: Db,
  input: NewCategory,
): Promise<Category> {
  const rows = await db.insert(categories).values(input).returning();
  const category = rows[0];

  if (!category) {
    throw new Error("Failed to create category");
  }

  return category;
}
