import {
  boolean,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { categories } from "@/db/schema/categories";
import { courses } from "@/db/schema/courses";

export const topicTags = pgTable(
  "topic_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    nameEn: text("name_en").notNull(),
    nameVi: text("name_vi").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    source: text("source"),
    courseCount: integer("course_count").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("topic_tags_slug_unique").on(table.slug)],
);

export const courseTopicTags = pgTable(
  "course_topic_tags",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => topicTags.id, { onDelete: "cascade" }),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    source: text("source"),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.tagId] })],
);

export type TopicTag = typeof topicTags.$inferSelect;
export type NewTopicTag = typeof topicTags.$inferInsert;
export type CourseTopicTag = typeof courseTopicTags.$inferSelect;
export type NewCourseTopicTag = typeof courseTopicTags.$inferInsert;
