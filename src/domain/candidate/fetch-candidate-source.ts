import type { Db } from "@/db";
import {
  listCandidatesByStatus,
  updateCandidate,
  findCandidateById,
} from "@/db/repositories/candidate-repository";
import type { CourseCandidate } from "@/db/schema";
import { recordApiUsage } from "@/domain/admin/api-usage";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { logger } from "@/lib/logger";
import {
  fetchCourseSource,
  type CourseSourceResult,
} from "@/services/fetch/course-source-fetcher";

export type FetchCandidateOptions = {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
  /** Admin refresh may fetch a non-terminal candidate again. */
  force?: boolean;
};

const REFRESHABLE_STATUSES = new Set([
  "DISCOVERED",
  "FETCHED",
  "ANALYZED",
  "READY_FOR_REVIEW",
  "ERROR",
]);

async function updateAfterFetch(
  db: Db,
  candidate: CourseCandidate,
  input: Parameters<typeof updateCandidate>[2],
  reason: string,
) {
  const updated = await updateCandidate(db, candidate.id, input);
  await writeAuditLog(db, {
    actorType: "WORKER",
    action: "CANDIDATE_SOURCE_FETCHED",
    entityType: "candidate",
    entityId: candidate.id,
    before: { discoveryStatus: candidate.discoveryStatus },
    after: {
      discoveryStatus: updated.discoveryStatus,
      sourceFetchedAt: updated.sourceFetchedAt,
      sourceFinalUrl: updated.sourceFinalUrl,
    },
    reason,
  });
  return updated;
}

function serializeSourceResult(result: CourseSourceResult): Record<string, unknown> {
  return {
    status: result.status,
    requestedUrl: result.requestedUrl,
    finalUrl: result.finalUrl,
    contentType: result.contentType,
    title: result.title,
    description: result.description,
    canonicalUrl: result.canonicalUrl,
    images: result.images,
    evidence: result.evidence,
    warnings: result.warnings,
    errors: result.errors,
    policy: result.policy,
    redirectChain: result.redirectChain,
    httpStatus: result.httpStatus,
    fetchedAt: result.fetchedAt.toISOString(),
    textExcerptPreview: result.textExcerpt.slice(0, 500),
  };
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function mapFetchFailureStatus(reason: string): "ERROR" | "INVALID" {
  if (
    reason === "http_404" ||
    reason === "http_410" ||
    reason === "unsafe_scheme" ||
    reason.startsWith("redirect_private") ||
    reason.startsWith("redirect_loopback") ||
    reason.startsWith("redirect_blocked")
  ) {
    return "INVALID";
  }
  return "ERROR";
}

/**
 * Fetch source HTML for a DISCOVERED candidate and enrich metadata/evidence.
 * Failures never throw out of the batch — candidate is marked ERROR/INVALID safely.
 */
export async function fetchCandidateSource(
  db: Db,
  candidateId: string,
  options: FetchCandidateOptions = {},
) {
  const candidate = await findCandidateById(db, candidateId);
  if (!candidate) {
    throw new Error("Candidate not found");
  }

  if (
    candidate.discoveryStatus !== "DISCOVERED" &&
    (!options.force || !REFRESHABLE_STATUSES.has(candidate.discoveryStatus))
  ) {
    return candidate;
  }

  const started = Date.now();
  const result = await fetchCourseSource(candidate.sourceUrl || candidate.canonicalUrl, {
    providerSlug: candidate.provider,
    timeoutMs: options.timeoutMs,
    maxRedirects: options.maxRedirects,
    maxBytes: options.maxBytes,
    fetchImpl: options.fetchImpl,
  });

  const durationMs = Date.now() - started;

  logger.info("candidate.source_fetch", {
    candidate_id: candidateId,
    provider: candidate.provider,
    requested_url: result.requestedUrl,
    final_url: result.finalUrl,
    status: result.status,
    duration_ms: durationMs,
    error: result.errors[0] ?? null,
  });

  await recordApiUsage(db, {
    kind: "source_fetch",
    provider: candidate.provider ?? null,
    operation: "candidate_source",
    domain: hostnameOf(result.finalUrl ?? result.requestedUrl),
    httpStatus: result.httpStatus,
    ok: result.status === "ok",
    latencyMs: durationMs,
    error: result.errors[0] ?? null,
    meta: { candidateId, fetchPolicy: result.policy.fetch },
  });

  if (result.status === "skipped") {
    // SEARCH_RESULT_ONLY / NO_FETCH — leave DISCOVERED for AI on search snippets
    return updateAfterFetch(db, candidate, {
      sourceEvidenceJson: serializeSourceResult(result),
      sourceFetchedAt: result.fetchedAt,
      errorMessage:
        result.policy.fetch === "NO_FETCH"
          ? "Source fetch skipped by provider policy"
          : null,
    }, `source fetch ${result.status}: ${result.policy.fetch}`);
  }

  if (result.status === "error") {
    const reason = result.errors[0] ?? "fetch_failed";
    // Soft failures (timeout/429/5xx) keep candidate reviewable via search snippets
    if (
      reason === "timeout" ||
      reason === "network_error" ||
      reason === "http_429" ||
      reason === "http_403" ||
      reason.startsWith("http_5")
    ) {
      return updateAfterFetch(db, candidate, {
        sourceEvidenceJson: serializeSourceResult(result),
        sourceFetchedAt: result.fetchedAt,
        sourceFinalUrl: result.finalUrl,
        errorMessage: `Source fetch failed (${reason}); continuing with search snippets`,
      }, `source fetch soft failure: ${reason}`);
    }

    return updateAfterFetch(db, candidate, {
      discoveryStatus: mapFetchFailureStatus(reason),
      sourceEvidenceJson: serializeSourceResult(result),
      sourceFetchedAt: result.fetchedAt,
      sourceFinalUrl: result.finalUrl,
      errorMessage: `Source fetch failed: ${reason}`,
    }, `source fetch failure: ${reason}`);
  }

  const nextTitle = result.title?.trim() || candidate.rawTitle;
  const nextDescription =
    result.description?.trim() || candidate.rawDescription;
  const nextContent =
    result.textExcerpt.trim() ||
    [result.title, result.description, candidate.rawContent]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 20_000);

  return updateAfterFetch(db, candidate, {
    discoveryStatus: "FETCHED",
    rawTitle: nextTitle,
    rawDescription: nextDescription ? nextDescription.slice(0, 2000) : null,
    rawContent: nextContent.slice(0, 20_000),
    sourceEvidenceJson: serializeSourceResult(result),
    sourceFetchedAt: result.fetchedAt,
    sourceFinalUrl: result.finalUrl,
    sourceImageUrl: result.images[0] ?? null,
    errorMessage: result.warnings.length
      ? `Source fetch warnings: ${result.warnings.join(", ")}`
      : null,
  }, "source fetch completed");
}

export async function fetchPendingCandidates(
  db: Db,
  limit: number,
  options: FetchCandidateOptions = {},
) {
  const pending = await listCandidatesByStatus(db, "DISCOVERED", limit);
  const results = [];

  for (const candidate of pending) {
    try {
      results.push(await fetchCandidateSource(db, candidate.id, options));
    } catch (error) {
      logger.error("candidate.source_fetch", {
        candidate_id: candidate.id,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      results.push(
        await updateAfterFetch(db, candidate, {
          discoveryStatus: "ERROR",
          errorMessage:
            error instanceof Error
              ? `Source fetch exception: ${error.message}`
              : "Source fetch exception",
        }, "source fetch exception"),
      );
    }
  }

  return results;
}
