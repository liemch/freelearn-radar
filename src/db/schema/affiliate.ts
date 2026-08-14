import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  affiliateProviderTypeEnum,
  commerceProductGroupEnum,
} from "@/db/schema/enums";
import { courses } from "@/db/schema/courses";

export const affiliateProviders = pgTable(
  "affiliate_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerKey: text("provider_key").notNull(),
    providerType: affiliateProviderTypeEnum("provider_type").notNull(),
    displayName: text("display_name").notNull(),
    allowedHosts: jsonb("allowed_hosts").$type<string[]>().notNull().default([]),
    enabled: boolean("enabled").notNull().default(false),
    disclosureRequired: boolean("disclosure_required").notNull().default(true),
    disclosureTextVi: text("disclosure_text_vi"),
    disclosureTextEn: text("disclosure_text_en"),
    trackingCapability: text("tracking_capability").default("INTERNAL"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("affiliate_providers_provider_key_uidx").on(table.providerKey),
  ],
);

export type AffiliateProvider = typeof affiliateProviders.$inferSelect;
export type NewAffiliateProvider = typeof affiliateProviders.$inferInsert;

export const affiliateCampaigns = pgTable(
  "affiliate_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateProviderId: uuid("affiliate_provider_id")
      .notNull()
      .references(() => affiliateProviders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    campaignKey: text("campaign_key").notNull(),
    destinationTemplate: text("destination_template").notNull(),
    productGroup: commerceProductGroupEnum("product_group"),
    enabled: boolean("enabled").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("affiliate_campaigns_campaign_key_uidx").on(table.campaignKey),
    index("affiliate_campaigns_provider_id_idx").on(table.affiliateProviderId),
  ],
);

export type AffiliateCampaign = typeof affiliateCampaigns.$inferSelect;
export type NewAffiliateCampaign = typeof affiliateCampaigns.$inferInsert;

export const affiliatePlacements = pgTable(
  "affiliate_placements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => affiliateCampaigns.id, { onDelete: "cascade" }),
    placementKey: text("placement_key").notNull(),
    topicSlug: text("topic_slug"),
    categorySlug: text("category_slug"),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    locale: text("locale"),
    priority: integer("priority").notNull().default(100),
    enabled: boolean("enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("affiliate_placements_key_idx").on(table.placementKey, table.enabled),
  ],
);

export type AffiliatePlacement = typeof affiliatePlacements.$inferSelect;
export type NewAffiliatePlacement = typeof affiliatePlacements.$inferInsert;

export const affiliateClicks = pgTable(
  "affiliate_clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerKey: text("provider_key").notNull(),
    campaignId: uuid("campaign_id").references(() => affiliateCampaigns.id, {
      onDelete: "set null",
    }),
    placementKey: text("placement_key").notNull(),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    topicSlug: text("topic_slug"),
    locale: text("locale"),
    destinationHost: text("destination_host"),
    clickedAt: timestamp("clicked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("affiliate_clicks_clicked_at_idx").on(table.clickedAt),
    index("affiliate_clicks_provider_key_idx").on(
      table.providerKey,
      table.clickedAt,
    ),
  ],
);

export type AffiliateClick = typeof affiliateClicks.$inferSelect;
export type NewAffiliateClick = typeof affiliateClicks.$inferInsert;
