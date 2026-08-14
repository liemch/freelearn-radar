import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { discoveryQueries } from "@/db/schema/discovery-queries";

export const discoveryRejections = pgTable(
  "discovery_rejections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discoveryQueryId: uuid("discovery_query_id").references(
      () => discoveryQueries.id,
      { onDelete: "set null" },
    ),
    url: text("url").notNull(),
    reason: text("reason").notNull(),
    matchedRule: text("matched_rule"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("discovery_rejections_discovery_query_id_idx").on(
      table.discoveryQueryId,
    ),
    index("discovery_rejections_created_at_idx").on(table.createdAt),
  ],
);

export type DiscoveryRejection = typeof discoveryRejections.$inferSelect;
export type NewDiscoveryRejection = typeof discoveryRejections.$inferInsert;
