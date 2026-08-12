import type {
  CertificateType,
  CourseStatus,
  PriceType,
} from "@/domain/course/types";
import { detectCourseChanges, summarizeChanges } from "@/domain/verification/change-detection";
import {
  createEvidence,
  mapEvidenceMethodToDb,
  type EvidenceRecord,
} from "@/domain/verification/evidence";
import { decideExpiration } from "@/domain/verification/expiration";
import { resolveCertificateType } from "@/domain/verification/certificate-status";
import { resolvePriceType } from "@/domain/verification/free-status";
import { assessCourseTrust } from "@/domain/verification/trust";
import { assessMetadataCompleteness } from "@/domain/quality/metadata-completeness";

export type VerificationEvidenceInput = {
  text: string;
  sourceUrl?: string | null;
  sourceProvider?: string | null;
  method?: EvidenceRecord["method"];
  availability?: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  aiPriceType?: PriceType | null;
  aiCertificateType?: CertificateType | null;
  aiConfidence?: number | null;
};

export type CourseVerificationSnapshot = {
  id: string;
  title: string;
  canonicalUrl: string;
  status: CourseStatus;
  priceType: PriceType;
  certificateType: CertificateType;
  lastVerifiedAt?: Date | null;
  language?: string | null;
  level?: string | null;
  durationMinutes?: number | null;
  description?: string | null;
  shortDescription?: string | null;
  instructor?: string | null;
  providerSlug?: string | null;
  providerName?: string | null;
  categoryCount?: number;
};

export type VerificationResult = {
  status: "VERIFIED" | "FAILED" | "EXPIRED";
  priceType: PriceType;
  certificateType: CertificateType;
  nextCourseStatus: CourseStatus;
  updateCourse: boolean;
  evidence: EvidenceRecord[];
  changeSummary: string | null;
  notes: string;
  pricingConfidence: number;
  certificateConfidence: number;
  verificationMethod: "SEARCH" | "PAGE_METADATA" | "AI" | "MANUAL";
  trustState: ReturnType<typeof assessCourseTrust>["state"];
  observedAt: Date;
};

/**
 * Pure verification engine: classify evidence → compare → produce result.
 * Persistence is handled by callers / verify-batch.
 */
export function produceVerificationResult(
  course: CourseVerificationSnapshot,
  evidenceInput: VerificationEvidenceInput,
  now = new Date(),
): VerificationResult {
  const method = evidenceInput.method ?? "PAGE_METADATA";
  const text = evidenceInput.text ?? "";

  if (!text.trim() && evidenceInput.availability === "UNKNOWN") {
    return {
      status: "FAILED",
      priceType: course.priceType,
      certificateType: course.certificateType,
      nextCourseStatus: course.status,
      updateCourse: false,
      evidence: [],
      changeSummary: null,
      notes: "No evidence retrieved",
      pricingConfidence: 0,
      certificateConfidence: 0,
      verificationMethod: mapEvidenceMethodToDb(method),
      trustState: "NEEDS_REVIEW",
      observedAt: now,
    };
  }

  const price = resolvePriceType({
    evidenceText: text,
    aiSuggestion: evidenceInput.aiPriceType,
    aiConfidence: evidenceInput.aiConfidence,
  });

  const certificate = resolveCertificateType({
    evidenceText: text,
    aiSuggestion: evidenceInput.aiCertificateType,
    aiConfidence: evidenceInput.aiConfidence,
  });

  const availability = evidenceInput.availability ?? "UNKNOWN";

  const expiration = decideExpiration({
    currentStatus: course.status,
    observedPriceType: price.priceType,
    availability,
    pricingConfidence: price.confidence,
  });

  const nextStatus = expiration.shouldUpdate
    ? expiration.nextStatus
    : course.status;

  const evidence: EvidenceRecord[] = [];

  if (text.trim()) {
    evidence.push(
      createEvidence({
        type: "PRICE",
        sourceUrl: evidenceInput.sourceUrl,
        sourceProvider: evidenceInput.sourceProvider,
        observedValue: `${price.priceType}: ${price.rationale}`,
        confidence: price.confidence,
        method,
        observedAt: now,
      }),
    );
    evidence.push(
      createEvidence({
        type: "CERTIFICATE",
        sourceUrl: evidenceInput.sourceUrl,
        sourceProvider: evidenceInput.sourceProvider,
        observedValue: `${certificate.certificateType}: ${certificate.rationale}`,
        confidence: certificate.confidence,
        method,
        observedAt: now,
      }),
    );
  }

  if (availability !== "UNKNOWN") {
    evidence.push(
      createEvidence({
        type: "AVAILABILITY",
        sourceUrl: evidenceInput.sourceUrl,
        sourceProvider: evidenceInput.sourceProvider,
        observedValue: availability,
        confidence: availability === "UNAVAILABLE" ? 0.8 : 0.7,
        method,
        observedAt: now,
      }),
    );
  }

  const changes = detectCourseChanges({
    previous: {
      priceType: course.priceType,
      certificateType: course.certificateType,
      status: course.status,
      title: course.title,
      canonicalUrl: course.canonicalUrl,
    },
    next: {
      priceType: price.priceType === "UNKNOWN" ? course.priceType : price.priceType,
      certificateType:
        certificate.certificateType === "UNKNOWN"
          ? course.certificateType
          : certificate.certificateType,
      status: nextStatus,
      title: course.title,
      canonicalUrl: course.canonicalUrl,
    },
  });

  const finalPrice =
    price.priceType !== "UNKNOWN" ? price.priceType : course.priceType;
  const finalCert =
    certificate.certificateType !== "UNKNOWN"
      ? certificate.certificateType
      : course.certificateType;

  const completeness = assessMetadataCompleteness({
    title: course.title,
    provider: course.providerName || course.providerSlug,
    canonicalUrl: course.canonicalUrl,
    description: course.description || course.shortDescription,
    hasCategory: (course.categoryCount ?? 0) > 0,
    level: course.level,
    language: course.language,
    durationMinutes: course.durationMinutes,
    priceType: finalPrice,
    certificateType: finalCert,
    lastVerifiedAt: now,
  });

  const trust = assessCourseTrust({
    lastVerifiedAt: now,
    verificationSucceeded: true,
    verificationFailed: false,
    priceType: finalPrice,
    certificateType: finalCert,
    pricingConfidence: price.confidence,
    certificateConfidence: certificate.confidence,
    metadataCompleteness: completeness.score,
    sourceScore: method === "MANUAL" ? 90 : method === "PROVIDER_DATA" ? 85 : 70,
    now,
  });

  const shouldUpdateFields =
    finalPrice !== course.priceType ||
    finalCert !== course.certificateType ||
    nextStatus !== course.status;

  let status: VerificationResult["status"] = "VERIFIED";
  if (nextStatus === "EXPIRED") {
    status = "EXPIRED";
  }

  return {
    status,
    priceType: finalPrice,
    certificateType: finalCert,
    nextCourseStatus: nextStatus,
    updateCourse: shouldUpdateFields || true, // always refresh lastVerifiedAt on success
    evidence,
    changeSummary: summarizeChanges(changes),
    notes: [
      price.rationale,
      certificate.rationale,
      expiration.reason,
      `Resolved ${finalPrice}/${finalCert}`,
    ].join(" | "),
    pricingConfidence: price.confidence,
    certificateConfidence: certificate.confidence,
    verificationMethod: mapEvidenceMethodToDb(method),
    trustState: trust.state,
    observedAt: now,
  };
}
