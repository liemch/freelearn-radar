import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { courses } from "@/db/schema/courses";
import {
  searchQueryLanguageEnum,
  searchRetrievalModeEnum,
} from "@/db/schema/enums";

/**
 * Privacy-conscious search request log (plan §86.2 / §100.2).
 * Prefer `query_hash` + bounded `normalized_query`; never store PII.
 */
export const searchQueries = pgTable(
  "search_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    queryHash: text("query_hash").notNull(),
    normalizedQuery: text("normalized_query"),
    locale: text("locale"),
    queryLanguage: searchQueryLanguageEnum("query_language")
      .notNull()
      .default("UNKNOWN"),
    resultCount: integer("result_count").notNull().default(0),
    zeroResult: boolean("zero_result").notNull().default(false),
    clickedCourseId: uuid("clicked_course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    filtersJson: jsonb("filters_json"),
    latencyMs: integer("latency_ms"),
    retrievalMode: searchRetrievalModeEnum("retrieval_mode")
      .notNull()
      .default("LEXICAL"),
    degraded: boolean("degraded").notNull().default(false),
    topScore: numeric("top_score", { precision: 8, scale: 4 }),
    unmetIntent: boolean("unmet_intent").notNull().default(false),
    lexicalWouldBeZero: boolean("lexical_would_be_zero"),
    rankingConfigVersion: text("ranking_config_version"),
    sessionHash: text("session_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("search_queries_created_at_idx").on(table.createdAt),
    index("search_queries_query_hash_created_at_idx").on(
      table.queryHash,
      table.createdAt,
    ),
    index("search_queries_zero_result_created_at_idx").on(
      table.zeroResult,
      table.createdAt,
    ),
    index("search_queries_unmet_intent_created_at_idx").on(
      table.unmetIntent,
      table.createdAt,
    ),
  ],
);

export type SearchQuery = typeof searchQueries.$inferSelect;
export type NewSearchQuery = typeof searchQueries.$inferInsert;
