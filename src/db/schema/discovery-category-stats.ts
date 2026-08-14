import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * M21.2 — Per-category discovery coverage observability.
 * Avoids Tech starvation without hard publish quotas.
 */
export const discoveryCategoryStats = pgTable(
  "discovery_category_stats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categorySlug: text("category_slug").notNull(),
    queriesRun: integer("queries_run").notNull().default(0),
    candidatesFound: integer("candidates_found").notNull().default(0),
    verifiedCount: integer("verified_count").notNull().default(0),
    publishedCount: integer("published_count").notNull().default(0),
    zeroCandidateRuns: integer("zero_candidate_runs").notNull().default(0),
    lastDiscoveredAt: timestamp("last_discovered_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("discovery_category_stats_slug_uidx").on(table.categorySlug),
    index("discovery_category_stats_published_idx").on(table.publishedCount),
  ],
);

export type DiscoveryCategoryStat =
  typeof discoveryCategoryStats.$inferSelect;
export type NewDiscoveryCategoryStat =
  typeof discoveryCategoryStats.$inferInsert;
