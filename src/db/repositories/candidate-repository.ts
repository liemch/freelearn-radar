import { desc, eq, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  courseCandidates,
  type CourseCandidate,
  type NewCourseCandidate,
} from "@/db/schema";
import type { DiscoveryStatus } from "@/domain/course/types";

export async function findCandidateByCanonicalUrl(
  db: Db,
  canonicalUrl: string,
): Promise<CourseCandidate | null> {
  const rows = await db
    .select()
    .from(courseCandidates)
    .where(eq(courseCandidates.canonicalUrl, canonicalUrl))
    .limit(1);

  return rows[0] ?? null;
}

export async function findCandidateById(
  db: Db,
  id: string,
): Promise<CourseCandidate | null> {
  const rows = await db
    .select()
    .from(courseCandidates)
    .where(eq(courseCandidates.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function createCandidate(
  db: Db,
  input: NewCourseCandidate,
): Promise<CourseCandidate> {
  const rows = await db.insert(courseCandidates).values(input).returning();
  const candidate = rows[0];

  if (!candidate) {
    throw new Error("Failed to create candidate");
  }

  return candidate;
}

export async function updateCandidate(
  db: Db,
  id: string,
  input: Partial<NewCourseCandidate>,
): Promise<CourseCandidate> {
  const rows = await db
    .update(courseCandidates)
    .set(input)
    .where(eq(courseCandidates.id, id))
    .returning();

  const candidate = rows[0];
  if (!candidate) {
    throw new Error("Candidate not found");
  }

  return candidate;
}

export async function listCandidates(
  db: Db,
  options?: { status?: DiscoveryStatus; limit?: number },
): Promise<CourseCandidate[]> {
  if (options?.status) {
    return listCandidatesByStatus(db, options.status, options.limit ?? 100);
  }

  return db
    .select()
    .from(courseCandidates)
    .orderBy(desc(courseCandidates.discoveredAt))
    .limit(options?.limit ?? 100);
}

export async function listCandidatesByStatus(
  db: Db,
  status: DiscoveryStatus,
  limit = 50,
): Promise<CourseCandidate[]> {
  return db
    .select()
    .from(courseCandidates)
    .where(eq(courseCandidates.discoveryStatus, status))
    .orderBy(desc(courseCandidates.discoveredAt))
    .limit(limit);
}

export async function countCandidatesByStatus(
  db: Db,
  status: DiscoveryStatus,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(courseCandidates)
    .where(eq(courseCandidates.discoveryStatus, status));

  return rows[0]?.count ?? 0;
}
