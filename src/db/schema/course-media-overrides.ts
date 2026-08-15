import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  customType,
} from "drizzle-orm/pg-core";

import { courses } from "@/db/schema/courses";
import { managedAssets } from "@/db/schema/managed-assets";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Bounded Admin course image overrides.
 * Source evidence on `courses.image_source_url` is never overwritten.
 */
export const courseMediaOverrides = pgTable("course_media_overrides", {
  courseId: uuid("course_id")
    .primaryKey()
    .references(() => courses.id, { onDelete: "cascade" }),
  contentType: text("content_type"),
  bytes: bytea("bytes"),
  byteLength: integer("byte_length"),
  remoteUrl: text("remote_url"),
  originalFilename: text("original_filename"),
  width: integer("width"),
  height: integer("height"),
  /** M24 — object-storage reference; bytea kept for legacy. */
  managedAssetId: uuid("managed_asset_id").references(() => managedAssets.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CourseMediaOverride = typeof courseMediaOverrides.$inferSelect;
export type NewCourseMediaOverride = typeof courseMediaOverrides.$inferInsert;

export const COURSE_MEDIA_MAX_BYTES = 1024 * 1024;
export const COURSE_MEDIA_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
