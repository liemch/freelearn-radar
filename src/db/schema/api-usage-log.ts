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

export const apiUsageLog = pgTable(
  "api_usage_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(),
    provider: text("provider"),
    operation: text("operation"),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    domain: text("domain"),
    httpStatus: integer("http_status"),
    ok: boolean("ok"),
    latencyMs: integer("latency_ms"),
    units: integer("units"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    workerVersion: text("worker_version"),
    error: text("error"),
    metaJson: jsonb("meta_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("api_usage_log_kind_created_at_idx").on(table.kind, table.createdAt),
    index("api_usage_log_created_at_idx").on(table.createdAt),
  ],
);

export type ApiUsageLog = typeof apiUsageLog.$inferSelect;
export type NewApiUsageLog = typeof apiUsageLog.$inferInsert;
