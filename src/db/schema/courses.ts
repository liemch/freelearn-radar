import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  certificateTypeEnum,
  courseLevelEnum,
  courseStatusEnum,
  priceTypeEnum,
} from "@/db/schema/enums";
import { providers } from "@/db/schema/providers";

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "restrict" }),
    canonicalUrl: text("canonical_url").notNull(),
    outboundUrl: text("outbound_url").notNull(),
    affiliateUrl: text("affiliate_url"),
    instructor: text("instructor"),
    language: text("language"),
    level: courseLevelEnum("level").notNull().default("UNKNOWN"),
    durationMinutes: integer("duration_minutes"),
    priceType: priceTypeEnum("price_type").notNull().default("UNKNOWN"),
    originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
    currentPrice: numeric("current_price", { precision: 10, scale: 2 }),
    currency: text("currency"),
    certificateType: certificateTypeEnum("certificate_type")
      .notNull()
      .default("UNKNOWN"),
    rating: numeric("rating", { precision: 3, scale: 2 }),
    ratingCount: integer("rating_count"),
    aiScore: integer("ai_score"),
    editorScore: integer("editor_score"),
    qualityScore: integer("quality_score"),
    status: courseStatusEnum("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("courses_slug_unique").on(table.slug),
    uniqueIndex("courses_canonical_url_unique").on(table.canonicalUrl),
  ],
);

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
