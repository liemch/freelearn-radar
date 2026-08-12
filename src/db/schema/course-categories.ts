import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";

import { categories } from "@/db/schema/categories";
import { courses } from "@/db/schema/courses";

export const courseCategories = pgTable(
  "course_categories",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.categoryId] })],
);

export type CourseCategory = typeof courseCategories.$inferSelect;
export type NewCourseCategory = typeof courseCategories.$inferInsert;
