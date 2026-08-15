import type { Db } from "@/db";
import {
  createCandidate,
  findCandidateByCanonicalUrl,
  findCandidateById,
  updateCandidate,
} from "@/db/repositories/candidate-repository";
import { discoveryRejections, type CourseCandidate } from "@/db/schema";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { classifyDiscoveryFailureReason } from "@/domain/coverage/failure-reasons";
import { detectDuplicate } from "@/domain/discovery/duplicate-detector";
import { classifyUrlShape } from "@/domain/discovery/url-shape-classifier";
import { prefilterCandidate } from "@/domain/quality/candidate-prefilter";
import type { SearchResult } from "@/services/search/search-provider";
import { isValidHttpUrl, normalizeUrl } from "@/lib/url";

export type IngestSearchResultInput = {
  result: SearchResult;
  searchQuery: string;
  providerHint?: string;
  /** When set, pre-ingest rejects are persisted to discovery_rejections (M26). */
  discoveryQueryId?: string;
};

async function recordPreIngestRejection(
  db: Db,
  input: {
    discoveryQueryId?: string;
    url: string;
    reason: string;
    matchedRule?: string | null;
  },
): Promise<void> {
  try {
    await db.insert(discoveryRejections).values({
      discoveryQueryId: input.discoveryQueryId ?? null,
      url: input.url.slice(0, 2000),
      reason: classifyDiscoveryFailureReason(input.reason),
      matchedRule: input.matchedRule ?? input.reason.slice(0, 200),
    });
  } catch {
    // Observability must never block discovery.
  }
}

export type IngestOutcome =
  | { status: "CREATED"; candidate: CourseCandidate }
  | { status: "DUPLICATE"; reason: "CANDIDATE" | "COURSE"; existingId: string }
  | { status: "INVALID"; error: string };

export async function ingestSearchResult(
  db: Db,
  input: IngestSearchResultInput,
): Promise<IngestOutcome> {
  if (!isValidHttpUrl(input.result.url)) {
    await recordPreIngestRejection(db, {
      discoveryQueryId: input.discoveryQueryId,
      url: input.result.url,
      reason: "Invalid external URL",
    });
    return { status: "INVALID", error: "Invalid external URL" };
  }

  let canonicalUrl: string;
  try {
    canonicalUrl = normalizeUrl(input.result.url);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "URL normalize failed";
    await recordPreIngestRejection(db, {
      discoveryQueryId: input.discoveryQueryId,
      url: input.result.url,
      reason: message,
    });
    return {
      status: "INVALID",
      error: message,
    };
  }

  // M19 §67.5 — reject known non-course shapes before fetch/AI spend.
  const shape = classifyUrlShape(canonicalUrl);
  if (shape.class === "KNOWN_NON_COURSE") {
    const error = `NON_COURSE_PATTERN: ${shape.reason}${
      shape.matchedRule ? ` (${shape.matchedRule})` : ""
    }`;
    await recordPreIngestRejection(db, {
      discoveryQueryId: input.discoveryQueryId,
      url: canonicalUrl,
      reason: error,
      matchedRule: shape.matchedRule,
    });
    return {
      status: "INVALID",
      error,
    };
  }

  const prefilter = prefilterCandidate({
    url: canonicalUrl,
    title: input.result.title,
    content: input.result.content,
  });
  if (!prefilter.accept) {
    await recordPreIngestRejection(db, {
      discoveryQueryId: input.discoveryQueryId,
      url: canonicalUrl,
      reason: prefilter.reason,
    });
    return { status: "INVALID", error: prefilter.reason };
  }

  const duplicate = await detectDuplicate(db, canonicalUrl);
  if (duplicate.duplicate) {
    await recordPreIngestRejection(db, {
      discoveryQueryId: input.discoveryQueryId,
      url: canonicalUrl,
      reason: `DUPLICATE:${duplicate.reason}`,
      matchedRule: duplicate.existingId,
    });
    return {
      status: "DUPLICATE",
      reason: duplicate.reason,
      existingId: duplicate.existingId,
    };
  }

  const candidate = await createCandidate(db, {
    sourceType: "SEARCH",
    searchQuery: input.searchQuery,
    sourceUrl: input.result.url,
    canonicalUrl,
    rawTitle: input.result.title,
    rawDescription: input.result.content.slice(0, 2000),
    rawContent: input.result.content.slice(0, 20_000),
    provider: input.providerHint ?? null,
    discoveryStatus: "DISCOVERED",
  });

  await writeAuditLog(db, {
    actorType: "CRON",
    action: "CANDIDATE_DISCOVERED",
    entityType: "candidate",
    entityId: candidate.id,
    after: {
      sourceType: candidate.sourceType,
      discoveryStatus: candidate.discoveryStatus,
      provider: candidate.provider,
      searchQuery: candidate.searchQuery,
      canonicalUrl: candidate.canonicalUrl,
    },
  });

  return { status: "CREATED", candidate };
}

export async function markCandidateDuplicate(
  db: Db,
  candidateId: string,
  errorMessage: string,
): Promise<CourseCandidate> {
  const before = await findCandidateById(db, candidateId);
  const updated = await updateCandidate(db, candidateId, {
    discoveryStatus: "DUPLICATE",
    errorMessage,
  });

  await writeAuditLog(db, {
    actorType: "WORKER",
    action: "CANDIDATE_DUPLICATE",
    entityType: "candidate",
    entityId: candidateId,
    before: before ? { discoveryStatus: before.discoveryStatus } : null,
    after: { discoveryStatus: updated.discoveryStatus },
    reason: errorMessage.slice(0, 500),
  });

  return updated;
}

export async function getOrCreateManualCandidate(
  db: Db,
  url: string,
): Promise<CourseCandidate> {
  const canonicalUrl = normalizeUrl(url);
  const existing = await findCandidateByCanonicalUrl(db, canonicalUrl);
  if (existing) {
    return existing;
  }

  const candidate = await createCandidate(db, {
    sourceType: "MANUAL",
    sourceUrl: url,
    canonicalUrl,
    discoveryStatus: "DISCOVERED",
  });

  await writeAuditLog(db, {
    actorType: "USER",
    action: "CANDIDATE_CREATED_MANUALLY",
    entityType: "candidate",
    entityId: candidate.id,
    after: {
      sourceType: candidate.sourceType,
      discoveryStatus: candidate.discoveryStatus,
      canonicalUrl: candidate.canonicalUrl,
    },
  });

  return candidate;
}
