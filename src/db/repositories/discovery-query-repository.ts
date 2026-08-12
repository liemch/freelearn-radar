import { and, asc, eq } from "drizzle-orm";

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
