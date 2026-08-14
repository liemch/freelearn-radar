import { and, eq } from "drizzle-orm";

import type { Db } from "@/db";
import {
  courseWatches,
  type CourseWatch,
} from "@/db/schema";
import { findCourseById } from "@/db/repositories/course-repository";
import {
  generateWatchToken,
  hashWatchToken,
  isConfirmTokenExpired,
  verifyUnsubscribeToken,
} from "@/domain/alerts/watch-token";

export { generateWatchToken };

export type RequestWatchInput = {
  courseId: string;
  email: string;
  locale?: string | null;
};

export type RequestWatchResult = {
  watch: CourseWatch;
  /**
   * Plaintext, returned exactly once for the confirmation email. Only its digest
   * is persisted, so this is the sole opportunity to send it.
   */
  confirmToken: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Create or refresh a PENDING watch. The caller receives the plaintext confirm
 * token to email; the row stores only its hash.
 */
export async function requestWatch(
  db: Db,
  input: RequestWatchInput,
): Promise<RequestWatchResult> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email");
  }

  const course = await findCourseById(db, input.courseId);
  if (!course) {
    throw new Error("Course not found");
  }

  const confirmToken = generateWatchToken();
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
    // Already subscribed: do not reissue a token, and do not re-send mail.
    if (row.status === "CONFIRMED" || row.status === "NOTIFIED") {
      return { watch: row, confirmToken: null };
    }

    const updated = await db
      .update(courseWatches)
      .set({
        status: "PENDING",
        confirmToken: hashWatchToken(confirmToken),
        locale,
        createdAt: new Date(),
        confirmedAt: null,
        notifiedAt: null,
      })
      .where(eq(courseWatches.id, row.id))
      .returning();

    const next = updated[0];
    if (!next) throw new Error("Failed to update watch");
    return { watch: next, confirmToken };
  }

  const inserted = await db
    .insert(courseWatches)
    .values({
      courseId: input.courseId,
      email,
      locale,
      status: "PENDING",
      confirmToken: hashWatchToken(confirmToken),
    })
    .returning();

  const created = inserted[0];
  if (!created) throw new Error("Failed to create watch");
  return { watch: created, confirmToken };
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
    .where(eq(courseWatches.confirmToken, hashWatchToken(trimmed)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.status === "UNSUBSCRIBED") return row;
  if (row.status === "CONFIRMED" || row.status === "NOTIFIED") return row;
  if (isConfirmTokenExpired(row.createdAt)) return null;

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

/**
 * Unsubscribe is addressed by watch id and authenticated by a derived token, so
 * an unsubscribe link stays valid for the life of the subscription without any
 * credential being stored.
 */
export async function unsubscribeWatch(
  db: Db,
  watchId: string,
  token: string,
): Promise<CourseWatch | null> {
  if (!watchId.trim() || !token.trim()) return null;
  if (!verifyUnsubscribeToken(watchId, token)) return null;

  const updated = await db
    .update(courseWatches)
    .set({
      status: "UNSUBSCRIBED",
      confirmToken: null,
    })
    .where(eq(courseWatches.id, watchId))
    .returning();

  return updated[0] ?? null;
}
