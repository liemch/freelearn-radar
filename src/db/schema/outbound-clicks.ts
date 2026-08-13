import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { courses } from "@/db/schema/courses";
import { providers } from "@/db/schema/providers";

export const outboundClicks = pgTable(
  "outbound_clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "restrict" }),
    referrer: text("referrer"),
    utmSource: text("utm_source"),
    clickedAt: timestamp("clicked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("outbound_clicks_course_id_idx").on(table.courseId),
    index("outbound_clicks_provider_id_idx").on(table.providerId),
    index("outbound_clicks_clicked_at_idx").on(sql`${table.clickedAt} DESC`),
  ],
);

export type OutboundClick = typeof outboundClicks.$inferSelect;
export type NewOutboundClick = typeof outboundClicks.$inferInsert;
