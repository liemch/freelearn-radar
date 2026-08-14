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
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  couponOfferStatusEnum,
  couponSourceHealthEnum,
  couponSourceTypeEnum,
} from "@/db/schema/enums";
import { courses } from "@/db/schema/courses";
import { providers } from "@/db/schema/providers";

/**
 * M21.3 — Coupon aggregator registry. Discovery-only; never Truth.
 */
export const couponSources = pgTable(
  "coupon_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    sourceKey: text("source_key").notNull(),
    sourceType: couponSourceTypeEnum("source_type").notNull().default("HTML"),
    baseUrl: text("base_url").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    priority: integer("priority").notNull().default(100),
    discoveryOnly: boolean("discovery_only").notNull().default(true),
    healthStatus: couponSourceHealthEnum("health_status")
      .notNull()
      .default("UNKNOWN"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    candidatesDiscovered: integer("candidates_discovered").notNull().default(0),
    verificationSuccessRate: numeric("verification_success_rate", {
      precision: 5,
      scale: 4,
    }),
    active100OffRate: numeric("active_100_off_rate", {
      precision: 5,
      scale: 4,
    }),
    expiredAtDiscoveryRate: numeric("expired_at_discovery_rate", {
      precision: 5,
      scale: 4,
    }),
    duplicateRate: numeric("duplicate_rate", { precision: 5, scale: 4 }),
    qualityAcceptRate: numeric("quality_accept_rate", {
      precision: 5,
      scale: 4,
    }),
    configJson: jsonb("config_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("coupon_sources_source_key_uidx").on(table.sourceKey),
    index("coupon_sources_enabled_priority_idx").on(
      table.enabled,
      table.priority,
    ),
  ],
);

export type CouponSource = typeof couponSources.$inferSelect;
export type NewCouponSource = typeof couponSources.$inferInsert;

/**
 * Raw coupon candidates from aggregators — not publishable Truth.
 */
export const couponCandidates = pgTable(
  "coupon_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id").references(() => couponSources.id, {
      onDelete: "set null",
    }),
    providerSlug: text("provider_slug").notNull().default("udemy"),
    canonicalUrl: text("canonical_url").notNull(),
    offerUrl: text("offer_url").notNull(),
    couponCode: text("coupon_code"),
    discoveredFrom: text("discovered_from"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sourceClaim: text("source_claim"),
    sourcePrice: numeric("source_price", { precision: 10, scale: 2 }),
    sourceOriginalPrice: numeric("source_original_price", {
      precision: 10,
      scale: 2,
    }),
    sourceExpiresAt: timestamp("source_expires_at", { withTimezone: true }),
    status: couponOfferStatusEnum("status").notNull().default("DISCOVERED"),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    lastError: text("last_error"),
    rawPayloadJson: jsonb("raw_payload_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("coupon_candidates_status_discovered_idx").on(
      table.status,
      table.discoveredAt,
    ),
    index("coupon_candidates_canonical_url_idx").on(table.canonicalUrl),
    index("coupon_candidates_coupon_code_idx").on(table.couponCode),
  ],
);

export type CouponCandidate = typeof couponCandidates.$inferSelect;
export type NewCouponCandidate = typeof couponCandidates.$inferInsert;

/**
 * Verified (or historical) course offers. Coupon code nullable for non-coupon offers.
 * Append-friendly: status transitions update the row; historical observations
 * remain in coupon_candidates / course_price_events.
 */
export const courseOffers = pgTable(
  "course_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    providerId: uuid("provider_id").references(() => providers.id, {
      onDelete: "set null",
    }),
    providerSlug: text("provider_slug").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    offerUrl: text("offer_url").notNull(),
    couponCode: text("coupon_code"),
    offerType: text("offer_type").notNull().default("COUPON"),
    discountPercent: integer("discount_percent"),
    priceAfterDiscount: numeric("price_after_discount", {
      precision: 10,
      scale: 2,
    }),
    currency: text("currency"),
    status: couponOfferStatusEnum("status").notNull().default("DISCOVERED"),
    discoveredFrom: text("discovered_from"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    nextRecheckAt: timestamp("next_recheck_at", { withTimezone: true }),
    lastError: text("last_error"),
    candidateId: uuid("candidate_id").references(() => couponCandidates.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("course_offers_status_verified_idx").on(
      table.status,
      table.verifiedAt,
    ),
    index("course_offers_course_id_idx").on(table.courseId),
    index("course_offers_next_recheck_idx").on(table.nextRecheckAt),
    uniqueIndex("course_offers_offer_url_uidx").on(table.offerUrl),
  ],
);

export type CourseOffer = typeof courseOffers.$inferSelect;
export type NewCourseOffer = typeof courseOffers.$inferInsert;
