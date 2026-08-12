import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { courses } from "@/db/schema/courses";
import { providers } from "@/db/schema/providers";

export const outboundClicks = pgTable("outbound_clicks", {
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
});

export type OutboundClick = typeof outboundClicks.$inferSelect;
export type NewOutboundClick = typeof outboundClicks.$inferInsert;
