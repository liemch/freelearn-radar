import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const providers = pgTable(
  "providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    domain: text("domain").notNull(),
    logoUrl: text("logo_url"),
    affiliateEnabled: boolean("affiliate_enabled").notNull().default(false),
    affiliateTemplate: text("affiliate_template"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("providers_slug_unique").on(table.slug),
    uniqueIndex("providers_domain_unique").on(table.domain),
  ],
);

export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
