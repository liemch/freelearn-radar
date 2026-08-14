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

import {
  certificateTypeEnum,
  extractionMethodEnum,
  observationFetchStatusEnum,
  priceTypeEnum,
} from "@/db/schema/enums";
import { courses } from "@/db/schema/courses";

export const courseObservations = pgTable(
  "course_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    fetchStatus: observationFetchStatusEnum("fetch_status").notNull(),
    httpStatus: integer("http_status"),
    finalUrl: text("final_url"),
    contentHash: text("content_hash"),
    etag: text("etag"),
    priceType: priceTypeEnum("price_type"),
    priceAmount: numeric("price_amount", { precision: 10, scale: 2 }),
    currency: text("currency"),
    observedRegion: text("observed_region"),
    certificateType: certificateTypeEnum("certificate_type"),
    enrollmentOpen: boolean("enrollment_open"),
    evidenceUrl: text("evidence_url"),
    evidenceSnippet: text("evidence_snippet"),
    extractionMethod: extractionMethodEnum("extraction_method"),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    fetchPolicyUsed: text("fetch_policy_used"),
    workerVersion: text("worker_version"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("course_observations_course_observed_at_idx").on(
      table.courseId,
      table.observedAt,
    ),
  ],
);

export type CourseObservation = typeof courseObservations.$inferSelect;
export type NewCourseObservation = typeof courseObservations.$inferInsert;
