import type { Db } from "@/db";
import {
  findCandidateById,
  updateCandidate,
} from "@/db/repositories/candidate-repository";
import {
  applyAutoReject,
  evaluateAutoReject,
} from "@/domain/candidate/auto-reject";
import { shouldRouteToExtraReview } from "@/domain/quality/confidence";
import {
  prefilterCandidate,
  shouldReuseAnalysis,
  simpleContentHash,
} from "@/domain/quality/candidate-prefilter";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { AIProvider } from "@/services/ai/ai-provider";

const ANALYZABLE_STATUSES = new Set(["DISCOVERED", "FETCHED"]);

/** Statuses an admin may explicitly retry from. */
const RETRYABLE_STATUSES = new Set([
  "DISCOVERED",
  "FETCHED",
  "ANALYZED",
  "READY_FOR_REVIEW",
  "ERROR",
]);

export async function analyzeCandidate(
  db: Db,
  ai: AIProvider,
  candidateId: string,
  options: { force?: boolean } = {},
) {
  const candidate = await findCandidateById(db, candidateId);
  if (!candidate) {
    throw new Error("Candidate not found");
  }

  const allowed = options.force ? RETRYABLE_STATUSES : ANALYZABLE_STATUSES;
  if (!allowed.has(candidate.discoveryStatus)) {
    if (options.force) {
      throw new Error(
        `Cannot re-analyze a candidate in status ${candidate.discoveryStatus}`,
      );
    }
    return candidate;
  }

  const earlyReject = evaluateAutoReject(candidate);
  if (earlyReject.reject) {
    return applyAutoReject(db, candidateId, earlyReject.rule);
  }

  const prefilter = prefilterCandidate({
    url: candidate.canonicalUrl,
    title: candidate.rawTitle,
    content: candidate.rawContent || candidate.rawDescription,
  });

  if (!prefilter.accept) {
    return updateCandidate(db, candidateId, {
      discoveryStatus: "INVALID",
      errorMessage: `Prefilter rejected: ${prefilter.reason}`,
      analyzedAt: new Date(),
    });
  }

  const contentHash = simpleContentHash([
    candidate.canonicalUrl,
    candidate.rawTitle,
    candidate.rawDescription,
    candidate.rawContent,
  ]);

  const previousHash =
    candidate.aiAnalysisJson &&
    typeof candidate.aiAnalysisJson === "object" &&
    candidate.aiAnalysisJson !== null &&
    "_contentHash" in candidate.aiAnalysisJson
      ? String(
          (candidate.aiAnalysisJson as Record<string, unknown>)._contentHash,
        )
      : null;

  if (
    !options.force &&
    shouldReuseAnalysis({
      previousContentHash: previousHash,
      currentContentHash: contentHash,
      previousAnalyzedAt: candidate.analyzedAt,
    }) &&
    candidate.aiAnalysisJson
  ) {
    logger.info("candidate.analyze", {
      candidateId,
      status: "reused",
    });
    return candidate;
  }

  try {
    const analysis = await ai.analyzeCourse({
      url: candidate.canonicalUrl,
      title: candidate.rawTitle,
      description: candidate.rawDescription,
      content: candidate.rawContent,
      providerHint: candidate.provider,
    });

    const needsExtraReview =
      analysis.is_course && shouldRouteToExtraReview(analysis.confidence);

    const analyzedFields = {
      aiAnalysisJson: { ...analysis, _contentHash: contentHash },
      confidence: String(analysis.confidence),
      analyzedAt: new Date(),
      provider: analysis.provider,
      rawTitle: analysis.title || candidate.rawTitle,
    };

    if (!analysis.is_course) {
      const decision = evaluateAutoReject({
        ...candidate,
        ...analyzedFields,
      });
      if (decision.reject) {
        await updateCandidate(db, candidateId, analyzedFields);
        return applyAutoReject(db, candidateId, decision.rule);
      }
      return updateCandidate(db, candidateId, {
        ...analyzedFields,
        discoveryStatus: "INVALID",
        errorMessage: "AI marked content as not a course",
      });
    }

    return updateCandidate(db, candidateId, {
      ...analyzedFields,
      discoveryStatus: needsExtraReview ? "ANALYZED" : "READY_FOR_REVIEW",
      errorMessage: needsExtraReview
        ? "Low AI confidence — extra human review recommended"
        : null,
    });
  } catch (error) {
    logger.error("candidate.analyze", {
      candidateId,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return updateCandidate(db, candidateId, {
      discoveryStatus: "ERROR",
      errorMessage:
        error instanceof Error ? error.message.slice(0, 500) : "AI analysis failed",
      analyzedAt: new Date(),
    });
  }
}

export async function analyzePendingCandidates(
  db: Db,
  ai: AIProvider,
  limit?: number,
) {
  const { listCandidatesByStatus } = await import(
    "@/db/repositories/candidate-repository"
  );
  const max = limit ?? getServerEnv().AI_ANALYSIS_LIMIT;
  const fetched = await listCandidatesByStatus(db, "FETCHED", max);
  const remaining = Math.max(0, max - fetched.length);
  const discovered =
    remaining > 0
      ? await listCandidatesByStatus(db, "DISCOVERED", remaining)
      : [];

  const pending = [...fetched, ...discovered];
  const results = [];
  for (const candidate of pending) {
    results.push(await analyzeCandidate(db, ai, candidate.id));
  }

  return results;
}
