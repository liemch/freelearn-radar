import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { Db } from "@/db";
import {
  courseWatches,
  type CourseWatch,
} from "@/db/schema";
import { findCourseById } from "@/db/repositories/course-repository";

export function generateWatchToken(): string {
  return randomBytes(32).toString("hex");
}

export type RequestWatchInput = {
  courseId: string;
  email: string;
  locale?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Create or refresh a PENDING watch with confirm + unsubscribe tokens.
 */
export async function requestWatch(
  db: Db,
  input: RequestWatchInput,
): Promise<CourseWatch> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email");
  }

  const course = await findCourseById(db, input.courseId);
  if (!course) {
    throw new Error("Course not found");
  }

  const confirmToken = generateWatchToken();
  const unsubscribeToken = generateWatchToken();
  const locale = input.locale?.trim() || null;

  const existing = await db
    .select()
    .from(courseWatches)
    .where(
      and(
        eq(courseWatches.courseId, input.courseId),
        eq(courseWatches.email, email),
      ),
    )
    .limit(1);

  const row = existing[0];
  if (row) {
    if (row.status === "CONFIRMED" || row.status === "NOTIFIED") {
      return row;
    }

    const updated = await db
      .update(courseWatches)
      .set({
        status: "PENDING",
        confirmToken,
        unsubscribeToken,
        locale,
        confirmedAt: null,
        notifiedAt: null,
      })
      .where(eq(courseWatches.id, row.id))
      .returning();

    const next = updated[0];
    if (!next) throw new Error("Failed to update watch");
    return next;
  }

  const inserted = await db
    .insert(courseWatches)
    .values({
      courseId: input.courseId,
      email,
      locale,
      status: "PENDING",
      confirmToken,
      unsubscribeToken,
    })
    .returning();

  const created = inserted[0];
  if (!created) throw new Error("Failed to create watch");
  return created;
}

export async function confirmWatch(
  db: Db,
  token: string,
): Promise<CourseWatch | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const rows = await db
    .select()
    .from(courseWatches)
    .where(eq(courseWatches.confirmToken, trimmed))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.status === "UNSUBSCRIBED") return row;
  if (row.status === "CONFIRMED" || row.status === "NOTIFIED") return row;

  const updated = await db
    .update(courseWatches)
    .set({
      status: "CONFIRMED",
      confirmedAt: new Date(),
      confirmToken: null,
    })
    .where(eq(courseWatches.id, row.id))
    .returning();

  return updated[0] ?? null;
}

export async function unsubscribeWatch(
  db: Db,
  token: string,
): Promise<CourseWatch | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const rows = await db
    .select()
    .from(courseWatches)
    .where(eq(courseWatches.unsubscribeToken, trimmed))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const updated = await db
    .update(courseWatches)
    .set({
      status: "UNSUBSCRIBED",
      confirmToken: null,
    })
    .where(eq(courseWatches.id, row.id))
    .returning();

  return updated[0] ?? null;
}

export async function findWatchByConfirmToken(db: Db, token: string) {
  const rows = await db
    .select()
    .from(courseWatches)
    .where(eq(courseWatches.confirmToken, token.trim()))
    .limit(1);
  return rows[0] ?? null;
}
