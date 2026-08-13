import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { discoveryStatusEnum, sourceTypeEnum } from "@/db/schema/enums";

export const courseCandidates = pgTable(
  "course_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceType: sourceTypeEnum("source_type").notNull().default("SEARCH"),
    searchQuery: text("search_query"),
    sourceUrl: text("source_url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    rawTitle: text("raw_title"),
    rawDescription: text("raw_description"),
    rawContent: text("raw_content"),
    provider: text("provider"),
    discoveryStatus: discoveryStatusEnum("discovery_status")
      .notNull()
      .default("DISCOVERED"),
    aiAnalysisJson: jsonb("ai_analysis_json"),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (table) => [
    uniqueIndex("course_candidates_canonical_url_unique").on(table.canonicalUrl),
    index("course_candidates_discovery_status_discovered_at_idx").on(
      table.discoveryStatus,
      sql`${table.discoveredAt} DESC`,
    ),
  ],
);

export type CourseCandidate = typeof courseCandidates.$inferSelect;
export type NewCourseCandidate = typeof courseCandidates.$inferInsert;
