import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  searchEvalGroupEnum,
  searchEvalLocaleEnum,
} from "@/db/schema/enums";

export const searchEvaluations = pgTable(
  "search_evaluations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetVersion: text("dataset_version").notNull(),
    catalogSnapshotId: text("catalog_snapshot_id"),
    queryId: text("query_id").notNull(),
    locale: searchEvalLocaleEnum("locale").notNull(),
    queryGroup: searchEvalGroupEnum("query_group").notNull(),
    queryText: text("query_text").notNull(),
    expectedLabelsJson: jsonb("expected_labels_json"),
    annotatorAgreement: numeric("annotator_agreement", {
      precision: 5,
      scale: 4,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("search_evaluations_dataset_query_uidx").on(
      table.datasetVersion,
      table.queryId,
    ),
    index("search_evaluations_dataset_version_idx").on(table.datasetVersion),
  ],
);

export type SearchEvaluation = typeof searchEvaluations.$inferSelect;
export type NewSearchEvaluation = typeof searchEvaluations.$inferInsert;
