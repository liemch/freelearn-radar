import {
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  certificateTypeEnum,
  priceTypeEnum,
  verificationMethodEnum,
  verificationStatusEnum,
} from "@/db/schema/enums";
import { courses } from "@/db/schema/courses";

export const courseVerifications = pgTable("course_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  status: verificationStatusEnum("status").notNull().default("PENDING"),
  priceType: priceTypeEnum("price_type"),
  price: numeric("price", { precision: 10, scale: 2 }),
  certificateType: certificateTypeEnum("certificate_type"),
  evidenceUrl: text("evidence_url"),
  verifiedAt: timestamp("verified_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  verificationMethod: verificationMethodEnum("verification_method").notNull(),
});

export type CourseVerification = typeof courseVerifications.$inferSelect;
export type NewCourseVerification = typeof courseVerifications.$inferInsert;
