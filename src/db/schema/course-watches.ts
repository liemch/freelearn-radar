import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { watchStatusEnum } from "@/db/schema/enums";
import { courses } from "@/db/schema/courses";

export const courseWatches = pgTable(
  "course_watches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    locale: text("locale"),
    status: watchStatusEnum("status").notNull().default("PENDING"),
    confirmToken: text("confirm_token"),
    unsubscribeToken: text("unsubscribe_token"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (table) => [
    index("course_watches_course_id_idx").on(table.courseId),
    uniqueIndex("course_watches_course_id_email_unique").on(
      table.courseId,
      table.email,
    ),
  ],
);

export type CourseWatch = typeof courseWatches.$inferSelect;
export type NewCourseWatch = typeof courseWatches.$inferInsert;
