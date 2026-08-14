import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { searchRetrievalModeEnum } from "@/db/schema/enums";

export const searchBenchmarkRuns = pgTable(
  "search_benchmark_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetVersion: text("dataset_version").notNull(),
    retrievalMode: searchRetrievalModeEnum("retrieval_mode").notNull(),
    rankingConfigVersion: text("ranking_config_version"),
    embeddingModel: text("embedding_model"),
    ndcgAt10: numeric("ndcg_at_10", { precision: 8, scale: 4 }),
    precisionAt5: numeric("precision_at_5", { precision: 8, scale: 4 }),
    exactTitleSuccess: numeric("exact_title_success", {
      precision: 8,
      scale: 4,
    }),
    latencyP95: integer("latency_p95"),
    costEstimate: numeric("cost_estimate", { precision: 10, scale: 6 }),
    labelDecayRate: numeric("label_decay_rate", { precision: 5, scale: 4 }),
    metricsJson: jsonb("metrics_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("search_benchmark_runs_created_at_idx").on(table.createdAt),
    index("search_benchmark_runs_dataset_mode_idx").on(
      table.datasetVersion,
      table.retrievalMode,
    ),
  ],
);

export type SearchBenchmarkRun = typeof searchBenchmarkRuns.$inferSelect;
export type NewSearchBenchmarkRun = typeof searchBenchmarkRuns.$inferInsert;
