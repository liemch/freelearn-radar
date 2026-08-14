import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const discoveryQueries = pgTable(
  "discovery_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    category: text("category").notNull(),
    query: text("query").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    successCount: integer("success_count").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    junkRate: numeric("junk_rate", { precision: 5, scale: 4 }),
    lastJunkReviewAt: timestamp("last_junk_review_at", { withTimezone: true }),
  },
  (table) => [
    index("discovery_queries_enabled_next_run_at_idx").on(
      table.enabled,
      table.nextRunAt,
    ),
  ],
);

export type DiscoveryQuery = typeof discoveryQueries.$inferSelect;
export type NewDiscoveryQuery = typeof discoveryQueries.$inferInsert;
