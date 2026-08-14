import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { embeddingStatusEnum } from "@/db/schema/enums";
import { courses } from "@/db/schema/courses";
import { vector } from "@/db/schema/vector";

export const courseEmbeddings = pgTable(
  "course_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1024 }),
    embeddingModel: text("embedding_model").notNull(),
    embeddingVersion: text("embedding_version").notNull(),
    semanticDocumentVersion: text("semantic_document_version").notNull(),
    contentHash: text("content_hash").notNull(),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }),
    status: embeddingStatusEnum("status").notNull().default("PENDING"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("course_embeddings_course_model_version_uidx").on(
      table.courseId,
      table.embeddingModel,
      table.embeddingVersion,
    ),
    index("course_embeddings_status_idx").on(table.status),
    index("course_embeddings_model_version_status_idx").on(
      table.embeddingModel,
      table.embeddingVersion,
      table.status,
    ),
  ],
);

export type CourseEmbedding = typeof courseEmbeddings.$inferSelect;
export type NewCourseEmbedding = typeof courseEmbeddings.$inferInsert;

export const queryEmbeddingCache = pgTable(
  "query_embedding_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    queryHash: text("query_hash").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    embeddingVersion: text("embedding_version").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    hitCount: integer("hit_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("query_embedding_cache_hash_model_version_uidx").on(
      table.queryHash,
      table.embeddingModel,
      table.embeddingVersion,
    ),
  ],
);

export type QueryEmbeddingCache = typeof queryEmbeddingCache.$inferSelect;
export type NewQueryEmbeddingCache = typeof queryEmbeddingCache.$inferInsert;
