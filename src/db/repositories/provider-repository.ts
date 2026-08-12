import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import { providers, type NewProvider, type Provider } from "@/db/schema";

export async function listProviders(db: Db, activeOnly = true): Promise<Provider[]> {
  if (activeOnly) {
    return db.select().from(providers).where(eq(providers.active, true));
  }

  return db.select().from(providers);
}

export async function findProviderBySlug(
  db: Db,
  slug: string,
): Promise<Provider | null> {
  const rows = await db
    .select()
    .from(providers)
    .where(eq(providers.slug, slug))
    .limit(1);

  return rows[0] ?? null;
}

export async function createProvider(
  db: Db,
  input: NewProvider,
): Promise<Provider> {
  const rows = await db.insert(providers).values(input).returning();
  const provider = rows[0];

  if (!provider) {
    throw new Error("Failed to create provider");
  }

  return provider;
}
