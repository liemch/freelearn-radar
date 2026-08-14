import { and, asc, desc, eq } from "drizzle-orm";

import type { Db } from "@/db";
import {
  discoveryQueries,
  type DiscoveryQuery,
  type NewDiscoveryQuery,
} from "@/db/schema";

export async function listEnabledDiscoveryQueries(
  db: Db,
): Promise<DiscoveryQuery[]> {
  return db
    .select()
    .from(discoveryQueries)
    .where(eq(discoveryQueries.enabled, true))
    .orderBy(asc(discoveryQueries.lastRunAt));
}

export async function listDiscoveryQueries(
  db: Db,
): Promise<DiscoveryQuery[]> {
  return db
    .select()
    .from(discoveryQueries)
    .orderBy(desc(discoveryQueries.junkRate), asc(discoveryQueries.provider));
}

export async function findDiscoveryQueryById(
  db: Db,
  id: string,
): Promise<DiscoveryQuery | null> {
  const rows = await db
    .select()
    .from(discoveryQueries)
    .where(eq(discoveryQueries.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function updateDiscoveryQuery(
  db: Db,
  id: string,
  input: Partial<Pick<NewDiscoveryQuery, "enabled">>,
): Promise<DiscoveryQuery> {
  const rows = await db
    .update(discoveryQueries)
    .set(input)
    .where(eq(discoveryQueries.id, id))
    .returning();

  const query = rows[0];
  if (!query) {
    throw new Error("Discovery query not found");
  }

  return query;
}

export type DiscoveryQueryFacets = {
  providers: string[];
  categories: string[];
};

/** Distinct provider/category values available for scoping a manual discovery run (§31). */
export async function listDiscoveryQueryFacets(
  db: Db,
): Promise<DiscoveryQueryFacets> {
  const rows = await db
    .select({
      provider: discoveryQueries.provider,
      category: discoveryQueries.category,
    })
    .from(discoveryQueries)
    .where(eq(discoveryQueries.enabled, true));

  return {
    providers: [...new Set(rows.map((row) => row.provider))].sort(),
    categories: [...new Set(rows.map((row) => row.category))].sort(),
  };
}

export async function createDiscoveryQuery(
  db: Db,
  input: NewDiscoveryQuery,
): Promise<DiscoveryQuery> {
  const rows = await db.insert(discoveryQueries).values(input).returning();
  const query = rows[0];

  if (!query) {
    throw new Error("Failed to create discovery query");
  }

  return query;
}

export async function findDiscoveryQueryByProviderAndCategory(
  db: Db,
  provider: string,
  category: string,
  query: string,
): Promise<DiscoveryQuery | null> {
  const rows = await db
    .select()
    .from(discoveryQueries)
    .where(
      and(
        eq(discoveryQueries.provider, provider),
        eq(discoveryQueries.category, category),
        eq(discoveryQueries.query, query),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}
