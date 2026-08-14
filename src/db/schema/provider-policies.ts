import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { certificateTypeEnum, priceTypeEnum } from "@/db/schema/enums";
import { providers } from "@/db/schema/providers";

export const providerPolicies = pgTable(
  "provider_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    priceType: priceTypeEnum("price_type").notNull(),
    certificateType: certificateTypeEnum("certificate_type").notNull(),
    evidenceUrl: text("evidence_url"),
    policyNote: text("policy_note"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("provider_policies_provider_id_idx").on(table.providerId),
    index("provider_policies_provider_price_active_idx").on(
      table.providerId,
      table.priceType,
      table.active,
    ),
  ],
);

export type ProviderPolicy = typeof providerPolicies.$inferSelect;
export type NewProviderPolicy = typeof providerPolicies.$inferInsert;
