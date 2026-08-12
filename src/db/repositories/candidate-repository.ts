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
