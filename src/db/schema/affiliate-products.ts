import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { affiliateProviders } from "@/db/schema/affiliate";
import { courses } from "@/db/schema/courses";
import {
  affiliateMerchantEnum,
  affiliateProductStatusEnum,
  commerceProductGroupEnum,
} from "@/db/schema/enums";

export const affiliateProducts = pgTable(
  "affiliate_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchant: affiliateMerchantEnum("merchant").notNull(),
    title: text("title").notNull(),
    destinationUrl: text("destination_url").notNull(),
    merchantProductId: text("merchant_product_id"),
    imageUrl: text("image_url"),
    managedAssetId: uuid("managed_asset_id"),
    shortDescription: text("short_description"),
    productCategory: commerceProductGroupEnum("product_category").notNull(),
    displayPrice: text("display_price"),
    originalPrice: text("original_price"),
    currency: text("currency"),
    discountLabel: text("discount_label"),
    shopName: text("shop_name"),
    status: affiliateProductStatusEnum("status").notNull().default("INACTIVE"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    affiliateProviderId: uuid("affiliate_provider_id").references(
      () => affiliateProviders.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("affiliate_products_status_merchant_idx").on(
      table.status,
      table.merchant,
    ),
  ],
);

export const affiliateProductContexts = pgTable(
  "affiliate_product_contexts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => affiliateProducts.id, { onDelete: "cascade" }),
    placementKey: text("placement_key").notNull(),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "cascade",
    }),
    topicSlug: text("topic_slug"),
    categorySlug: text("category_slug"),
    priority: integer("priority").notNull().default(100),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("affiliate_product_contexts_product_idx").on(
      table.productId,
      table.enabled,
    ),
    index("affiliate_product_contexts_course_idx").on(
      table.courseId,
      table.enabled,
    ),
    index("affiliate_product_contexts_topic_idx").on(
      table.topicSlug,
      table.enabled,
    ),
    index("affiliate_product_contexts_category_idx").on(
      table.categorySlug,
      table.enabled,
    ),
  ],
);

export type AffiliateProduct = typeof affiliateProducts.$inferSelect;
export type NewAffiliateProduct = typeof affiliateProducts.$inferInsert;
export type AffiliateProductContext =
  typeof affiliateProductContexts.$inferSelect;
export type NewAffiliateProductContext =
  typeof affiliateProductContexts.$inferInsert;
