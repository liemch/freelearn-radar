import type { Db } from "@/db";
import {
  createVerification,
  listLatestVerificationByCourseIds,
} from "@/db/repositories/verification-repository";
import {
  findCourseById,
  listPublishedCoursesWithProvider,
  updateCourse,
} from "@/db/repositories/course-repository";
import { listProviderPolicyRules } from "@/db/repositories/provider-policy-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  compareRecheckPriority,
  computeRecheckPriority,
  type RecheckPriority,
} from "@/domain/verification/priority";
import { assertCertificateResolved } from "@/domain/verification/provider-policy";
import {
  produceVerificationResult,
  type CourseVerificationSnapshot,
  type VerificationEvidenceInput,
  type VerificationResult,
} from "@/domain/verification/verification-service";

export type EvidenceProvider = {
  gather(course: CourseVerificationSnapshot): Promise<VerificationEvidenceInput>;
};

export type VerifyBatchSummary = {
  considered: number;
  verified: number;
  failed: number;
  updated: number;
  byPriority: Record<RecheckPriority, number>;
};

export async function selectCoursesForVerification(
  db: Db,
  limit: number,
  now = new Date(),
): Promise<
  Array<
    CourseVerificationSnapshot & {
      priority: RecheckPriority;
      priorityScore: number;
      ratingCount?: number | null;
    }
  >
> {
  // Verification must still re-check courses that have gone PAID or trial-only,
  // otherwise they would never be corrected back or unpublished.
  const published = await listPublishedCoursesWithProvider(db, 200, {
    freeListOnly: false,
  });
  const latest = await listLatestVerificationByCourseIds(
    db,
    published.map((course) => course.id),
  );

  const scored = published.map((course) => {
    const last = latest.get(course.id);
    const priority = computeRecheckPriority({
      lastVerifiedAt: course.lastVerifiedAt,
      priceType: course.priceType,
      providerSlug: course.provider.slug,
      ratingCount: course.ratingCount,
      previousVerificationFailed: last?.status === "FAILED",
      hasUnknownPrice: course.priceType === "UNKNOWN",
      hasUnknownCertificate: course.certificateType === "UNKNOWN",
      now,
    });

    const snapshot: CourseVerificationSnapshot & {
      priority: RecheckPriority;
      priorityScore: number;
      ratingCount?: number | null;
    } = {
      id: course.id,
      title: course.title,
      canonicalUrl: course.canonicalUrl,
      status: course.status,
      priceType: course.priceType,
      certificateType: course.certificateType,
      lastVerifiedAt: course.lastVerifiedAt,
      language: course.language,
      level: course.level,
      durationMinutes: course.durationMinutes,
      description: course.description,
      shortDescription: course.shortDescription,
      instructor: course.instructor,
      providerSlug: course.provider.slug,
      providerName: course.provider.name,
      categoryCount: 1,
      priority: priority.priority,
      priorityScore: priority.score,
      ratingCount: course.ratingCount,
    };

    return snapshot;
  });

  return scored
    .sort((a, b) =>
      compareRecheckPriority(
        { priority: a.priority, score: a.priorityScore, reasons: [], overdueDays: 0 },
        { priority: b.priority, score: b.priorityScore, reasons: [], overdueDays: 0 },
      ),
    )
    .slice(0, Math.max(0, limit));
}

export async function runVerificationBatch(
  db: Db,
  evidenceProvider: EvidenceProvider,
  options?: { limit?: number; now?: Date },
): Promise<VerifyBatchSummary> {
  const env = getServerEnv();
  const limit = options?.limit ?? env.MAX_VERIFICATIONS_PER_RUN;
  const now = options?.now ?? new Date();

  const selected = await selectCoursesForVerification(db, limit, now);
  // Loaded once per batch: policy is the deterministic authority for certificate
  // resolution (§66.2) and does not change mid-run.
  const policies = await listProviderPolicyRules(db);
  const summary: VerifyBatchSummary = {
    considered: selected.length,
    verified: 0,
    failed: 0,
    updated: 0,
    byPriority: { CRITICAL: 0, HIGH: 0, NORMAL: 0, LOW: 0 },
  };

  for (const course of selected) {
    summary.byPriority[course.priority] += 1;

    try {
      const evidence = await evidenceProvider.gather(course);
      const result = produceVerificationResult(course, evidence, now, policies);
      await persistVerification(db, course.id, result);
      if (result.status === "FAILED") {
        summary.failed += 1;
      } else {
        summary.verified += 1;
      }
      if (result.updateCourse) {
        summary.updated += 1;
      }
    } catch (error) {
      summary.failed += 1;
      logger.error("verification.batch.item", {
        courseId: course.id,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      await createVerification(db, {
        courseId: course.id,
        status: "FAILED",
        priceType: course.priceType,
        certificateType: course.certificateType,
        evidenceUrl: course.canonicalUrl,
        verifiedAt: now,
        verificationMethod: "PAGE_METADATA",
        notes: error instanceof Error ? error.message.slice(0, 500) : "verify failed",
        evidenceJson: [],
      });
    }
  }

  logger.info("verification.batch", { status: "success", ...summary });
  return summary;
}

export async function persistVerification(
  db: Db,
  courseId: string,
  result: VerificationResult,
): Promise<void> {
  if (result.updateCourse) {
    assertCertificateResolved(result.priceType, result.certificateType);
  }

  await createVerification(db, {
    courseId,
    status: result.status,
    priceType: result.priceType,
    certificateType: result.certificateType,
    evidenceUrl: result.evidence[0]?.sourceUrl ?? null,
    verifiedAt: result.observedAt,
    verificationMethod: result.verificationMethod,
    notes: result.notes,
    changeSummary: result.changeSummary,
    evidenceJson: result.evidence,
  });

  if (result.updateCourse) {
    const before = await findCourseById(db, courseId);

    await updateCourse(db, courseId, {
      priceType: result.priceType,
      certificateType: result.certificateType,
      status: result.nextCourseStatus,
      ...(result.refreshLastVerifiedAt
        ? { lastVerifiedAt: result.observedAt }
        : {}),
    });

    // §79.3: a course whose price or status changed must say who changed it.
    await writeAuditLog(db, {
      actorType: "CRON",
      action: "COURSE_VERIFICATION_UPDATE",
      entityType: "course",
      entityId: courseId,
      before: before
        ? {
            priceType: before.priceType,
            certificateType: before.certificateType,
            status: before.status,
          }
        : null,
      after: {
        priceType: result.priceType,
        certificateType: result.certificateType,
        status: result.nextCourseStatus,
      },
      reason: result.changeSummary ?? result.notes,
    });
  }
}

/** Deterministic evidence provider for tests/simulations. */
export function createStaticEvidenceProvider(
  map: Record<string, VerificationEvidenceInput>,
): EvidenceProvider {
  return {
    async gather(course) {
      return (
        map[course.id] ?? {
          text: "",
          sourceUrl: course.canonicalUrl,
          availability: "UNKNOWN",
          method: "PAGE_METADATA",
        }
      );
    },
  };
}
