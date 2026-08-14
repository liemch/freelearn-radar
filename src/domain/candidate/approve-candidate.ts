import { slugify } from "@/lib/slug";
import type { Db } from "@/db";
import {
  findCandidateById,
  updateCandidate,
} from "@/db/repositories/candidate-repository";
import {
  createCourse,
  findCourseByCanonicalUrl,
  findCourseBySlug,
  setCourseCategories,
} from "@/db/repositories/course-repository";
import { listCategories } from "@/db/repositories/category-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { listProviderPolicyRules } from "@/db/repositories/provider-policy-repository";
import { createVerification } from "@/db/repositories/verification-repository";
import {
  canApproveCandidate,
  canRejectCandidate,
} from "@/domain/course/transitions";
import type { CourseAnalysis } from "@/services/ai/ai-provider";
import { courseAnalysisSchema } from "@/services/ai/ai-provider";
import type {
  CertificateType,
  CourseLevel,
  PriceType,
} from "@/domain/course/types";
import { assertSafeHttpUrl } from "@/lib/url";
import { writeAuditLog } from "@/domain/admin/audit-log";
import {
  assertVisibleOnPublicCatalog,
  deriveFreeDurability,
} from "@/domain/course/free-durability";
import { createEvidence } from "@/domain/verification/evidence";
import { resolvePriceType } from "@/domain/verification/free-status";
import {
  assertCertificateResolved,
  assertPriceTypeAllowed,
  resolveCertificateWithPolicy,
} from "@/domain/verification/provider-policy";
import {
  extractTopicSlugsFromAnalysis,
  syncCourseTopicTags,
} from "@/domain/taxonomy/topic-tags";
import { logger } from "@/lib/logger";

export type ApproveCandidateInput = {
  candidateId: string;
  actorId?: string;
  requestId?: string;
  overrides?: {
    title?: string;
    slug?: string;
    shortDescription?: string;
    description?: string;
    providerId?: string;
    categoryIds?: string[];
    priceType?: PriceType;
    certificateType?: CertificateType;
    level?: CourseLevel;
    language?: string;
    durationMinutes?: number | null;
    qualityScore?: number | null;
    instructor?: string;
  };
};

export class DuplicateCourseError extends Error {
  constructor(readonly courseId: string) {
    super("Canonical URL already published as a course");
    this.name = "DuplicateCourseError";
  }
}

function parseStoredAnalysis(value: unknown): CourseAnalysis | null {
  const parsed = courseAnalysisSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function resolveUniqueSlug(db: Db, base: string): Promise<string> {
  let slug = slugify(base) || `course-${Date.now()}`;
  let suffix = 1;

  while (await findCourseBySlug(db, slug)) {
    suffix += 1;
    slug = `${slugify(base)}-${suffix}`;
  }

  return slug;
}

export async function approveCandidate(db: Db, input: ApproveCandidateInput) {
  const candidate = await findCandidateById(db, input.candidateId);
  if (!candidate) {
    throw new Error("Candidate not found");
  }

  if (!canApproveCandidate(candidate.discoveryStatus)) {
    throw new Error(
      `Candidate status ${candidate.discoveryStatus} cannot be approved`,
    );
  }

  assertSafeHttpUrl(candidate.canonicalUrl);

  const analysis = parseStoredAnalysis(candidate.aiAnalysisJson);
  const providers = await listProviders(db, false);
  const categories = await listCategories(db);

  const provider =
    providers.find((item) => item.id === input.overrides?.providerId) ??
    providers.find(
      (item) =>
        item.slug === candidate.provider ||
        item.name.toLowerCase() === (analysis?.provider ?? "").toLowerCase(),
    );

  if (!provider) {
    throw new Error("Unable to resolve provider for approval");
  }

  const title =
    input.overrides?.title ||
    analysis?.title ||
    candidate.rawTitle ||
    "Untitled course";

  let slug: string;
  if (input.overrides?.slug) {
    const existingSlug = await findCourseBySlug(db, input.overrides.slug);
    if (existingSlug) {
      throw new Error("Slug already exists");
    }
    slug = input.overrides.slug;
  } else {
    slug = await resolveUniqueSlug(db, title);
  }

  const matchedCategoryIds =
    input.overrides?.categoryIds ??
    categories
      .filter((category) =>
        (analysis?.categories ?? []).some(
          (name) =>
            name.toLowerCase() === category.name.toLowerCase() ||
            name.toLowerCase() === category.slug.toLowerCase(),
        ),
      )
      .map((category) => category.id);

  const evidenceText = [
    candidate.rawTitle,
    candidate.rawDescription,
    candidate.rawContent,
  ]
    .filter(Boolean)
    .join("\n");

  // One load serves both price and certificate resolution below.
  const policies = await listProviderPolicyRules(db);

  const priceResolved = resolvePriceType({
    evidenceText,
    aiSuggestion: analysis?.price_type,
    aiConfidence: analysis?.confidence,
    providerSlug: provider.slug,
    policies,
  });

  let resolvedPriceType =
    input.overrides?.priceType || priceResolved.priceType || "UNKNOWN";
  if (input.overrides?.priceType) {
    assertPriceTypeAllowed("MANUAL", input.overrides.priceType);
  } else {
    try {
      assertPriceTypeAllowed(
        analysis?.price_type ? "AI" : "SEARCH",
        resolvedPriceType,
      );
    } catch {
      resolvedPriceType = "UNKNOWN";
    }
  }

  const certResolved = resolveCertificateWithPolicy({
    providerSlug: provider.slug,
    priceType: resolvedPriceType,
    evidenceText,
    aiSuggestion: analysis?.certificate_type,
    aiConfidence: analysis?.confidence,
    policies,
  });

  const resolvedCertificateType =
    input.overrides?.certificateType ||
    certResolved.certificateType ||
    "UNKNOWN";

  // A reviewer is present at this moment and can answer the question; publishing
  // an audit course with an unresolved certificate would strand it (§66.4).
  assertCertificateResolved(resolvedPriceType, resolvedCertificateType);

  // Approval publishes immediately — paid/trial courses must not reach the public
  // free catalog (project plan §66.4). Override priceType in admin before approving.
  assertVisibleOnPublicCatalog(resolvedPriceType);

  const freeDurability = deriveFreeDurability(provider.slug, resolvedPriceType);

  const now = new Date();

  try {
    const course = await db.transaction(async (tx) => {
      const txDb = tx as unknown as Db;

      // Re-check inside transaction to reduce TOCTOU races
      const existingCourse = await findCourseByCanonicalUrl(
        txDb,
        candidate.canonicalUrl,
      );
      if (existingCourse) {
        // Marking must happen after the rollback — see the catch block below.
        throw new DuplicateCourseError(existingCourse.id);
      }

      const fresh = await findCandidateById(txDb, candidate.id);
      if (!fresh || !canApproveCandidate(fresh.discoveryStatus)) {
        throw new Error("Candidate is no longer approvable");
      }

      const created = await createCourse(txDb, {
        title,
        slug,
        shortDescription:
          input.overrides?.shortDescription ||
          analysis?.why_learn ||
          candidate.rawDescription ||
          null,
        description:
          input.overrides?.description ||
          analysis?.summary_vi ||
          candidate.rawContent ||
          null,
        providerId: provider.id,
        canonicalUrl: candidate.canonicalUrl,
        outboundUrl: candidate.canonicalUrl,
        instructor: input.overrides?.instructor || null,
        language: input.overrides?.language || analysis?.language || "English",
        level: input.overrides?.level || analysis?.level || "UNKNOWN",
        durationMinutes:
          input.overrides?.durationMinutes ?? analysis?.duration_minutes ?? null,
        priceType: resolvedPriceType,
        certificateType: resolvedCertificateType,
        freeDurability,
        qualityScore:
          input.overrides?.qualityScore ?? analysis?.quality_score ?? null,
        aiScore: analysis?.quality_score ?? null,
        // Human approval is the publish gate for MVP (AI never auto-publishes).
        status: "PUBLISHED",
        publishedAt: now,
        lastVerifiedAt: now,
        imageSourceUrl: candidate.sourceImageUrl ?? null,
        imageLastVerifiedAt: candidate.sourceImageUrl ? now : null,
        imagePolicy: "REMOTE_ONLY",
      });

      await setCourseCategories(txDb, created.id, matchedCategoryIds);

      await createVerification(txDb, {
        courseId: created.id,
        status: "VERIFIED",
        priceType: resolvedPriceType,
        certificateType: resolvedCertificateType,
        evidenceUrl: candidate.canonicalUrl,
        verifiedAt: now,
        verificationMethod: "MANUAL",
        notes: "Initial verification on human approval",
        changeSummary: null,
        evidenceJson: [
          createEvidence({
            type: "PRICE",
            sourceUrl: candidate.canonicalUrl,
            sourceProvider: provider.slug,
            observedValue: `${resolvedPriceType} (${priceResolved.rationale})`,
            confidence: priceResolved.confidence,
            method: "MANUAL",
            observedAt: now,
          }),
          createEvidence({
            type: "CERTIFICATE",
            sourceUrl: candidate.canonicalUrl,
            sourceProvider: provider.slug,
            observedValue: `${resolvedCertificateType} (${certResolved.rationale})`,
            confidence: certResolved.confidence,
            method: "MANUAL",
            observedAt: now,
          }),
        ],
      });

      await updateCandidate(txDb, candidate.id, {
        discoveryStatus: "APPROVED",
        approvedAt: now,
        rejectedAt: null,
        errorMessage: null,
      });

      return created;
    });

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: input.actorId,
      action: "CANDIDATE_APPROVE",
      entityType: "candidate",
      entityId: input.candidateId,
      after: {
        courseId: course.id,
        priceType: course.priceType,
        certificateType: course.certificateType,
        status: course.status,
      },
      requestId: input.requestId,
    });

    // Best-effort topic tag sync — must not fail approval.
    try {
      const topicSlugs = extractTopicSlugsFromAnalysis(candidate.aiAnalysisJson);
      if (topicSlugs.length > 0) {
        await syncCourseTopicTags(
          db,
          course.id,
          topicSlugs,
          matchedCategoryIds[0] ?? null,
        );
      }
    } catch (error) {
      logger.warn("taxonomy.sync_on_approve", {
        courseId: course.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    // Best-effort embed enqueue — must not fail approval.
    try {
      const { enqueueCourseEmbedding } = await import(
        "@/domain/embedding/embed-batch"
      );
      await enqueueCourseEmbedding(db, course.id);
    } catch (error) {
      logger.warn("embedding.enqueue_on_approve", {
        courseId: course.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    return course;
  } catch (error) {
    if (error instanceof DuplicateCourseError) {
      // The transaction rolled back, so the DUPLICATE marking is written separately.
      await updateCandidate(db, candidate.id, {
        discoveryStatus: "DUPLICATE",
        errorMessage: `Duplicate of course ${error.courseId}`,
        rejectedAt: now,
      });
    }

    throw error;
  }
}

export async function rejectCandidate(
  db: Db,
  candidateId: string,
  reason?: string,
  audit?: { actorId?: string; requestId?: string },
) {
  const candidate = await findCandidateById(db, candidateId);
  if (!candidate) {
    throw new Error("Candidate not found");
  }

  if (!canRejectCandidate(candidate.discoveryStatus)) {
    throw new Error(
      `Candidate status ${candidate.discoveryStatus} cannot be rejected`,
    );
  }

  const updated = await updateCandidate(db, candidateId, {
    discoveryStatus: "REJECTED",
    rejectedAt: new Date(),
    errorMessage: reason?.slice(0, 500) || "Rejected by admin",
  });

  await writeAuditLog(db, {
    actorType: "USER",
    actorId: audit?.actorId,
    action: "CANDIDATE_REJECT",
    entityType: "candidate",
    entityId: candidateId,
    before: { discoveryStatus: candidate.discoveryStatus },
    after: { discoveryStatus: "REJECTED" },
    reason: reason?.slice(0, 500) || null,
    requestId: audit?.requestId,
  });

  return updated;
}
