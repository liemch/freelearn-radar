import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { priceEventTypeEnum } from "@/db/schema/enums";
import { courses } from "@/db/schema/courses";

export const coursePriceEvents = pgTable(
  "course_price_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    eventType: priceEventTypeEnum("event_type").notNull(),
    fromState: jsonb("from_state"),
    toState: jsonb("to_state"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmingObservationIds: jsonb("confirming_observation_ids"),
    region: text("region"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("course_price_events_course_id_idx").on(table.courseId),
    index("course_price_events_course_event_type_idx").on(
      table.courseId,
      table.eventType,
    ),
  ],
);

export type CoursePriceEvent = typeof coursePriceEvents.$inferSelect;
export type NewCoursePriceEvent = typeof coursePriceEvents.$inferInsert;
