import type { Db } from "@/db";
import {
  findCandidateById,
  updateCandidate,
} from "@/db/repositories/candidate-repository";
import type { CourseCandidate } from "@/db/schema";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { canRejectCandidate } from "@/domain/course/transitions";
import { classifyUrlShape } from "@/domain/discovery/url-shape-classifier";

/** Reserved for future domain-level blocks (M19 §79.5). Empty for now. */
const DOMAIN_BLACKLIST: readonly string[] = [];

export const AUTO_REJECT_PREFIX = "AUTO_REJECT:";

export type AutoRejectDecision = {
  reject: boolean;
  rule: string;
};

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Deterministic auto-reject only — never auto-approve (M19 §79.5).
 */
export function evaluateAutoReject(
  candidate: CourseCandidate,
): AutoRejectDecision {
  const shape = classifyUrlShape(candidate.canonicalUrl);
  if (shape.class === "KNOWN_NON_COURSE") {
    return {
      reject: true,
      rule: `KNOWN_NON_COURSE:${shape.matchedRule ?? "UNKNOWN"}`,
    };
  }

  const host = hostnameOf(candidate.canonicalUrl);
  if (host && DOMAIN_BLACKLIST.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
    return { reject: true, rule: `DOMAIN_BLACKLIST:${host}` };
  }

  if (
    candidate.aiAnalysisJson &&
    typeof candidate.aiAnalysisJson === "object" &&
    candidate.aiAnalysisJson !== null
  ) {
    const analysis = candidate.aiAnalysisJson as Record<string, unknown>;
    if (analysis.is_course === false) {
      const confidence =
        typeof analysis.confidence === "number"
          ? analysis.confidence
          : Number(candidate.confidence);
      if (Number.isFinite(confidence) && confidence >= 0.9) {
        return { reject: true, rule: "AI_NOT_COURSE_HIGH_CONFIDENCE" };
      }
    }
  }

  return { reject: false, rule: "" };
}

export function isAutoRejectedCandidate(candidate: CourseCandidate): boolean {
  return (
    candidate.discoveryStatus === "REJECTED" &&
    typeof candidate.errorMessage === "string" &&
    candidate.errorMessage.startsWith(AUTO_REJECT_PREFIX)
  );
}

export async function applyAutoReject(
  db: Db,
  candidateId: string,
  rule: string,
  audit?: { actorId?: string; requestId?: string },
): Promise<CourseCandidate> {
  const candidate = await findCandidateById(db, candidateId);
  if (!candidate) {
    throw new Error("Candidate not found");
  }

  if (!canRejectCandidate(candidate.discoveryStatus)) {
    throw new Error(
      `Candidate status ${candidate.discoveryStatus} cannot be auto-rejected`,
    );
  }

  const reason = `${AUTO_REJECT_PREFIX} ${rule}`.slice(0, 500);
  const updated = await updateCandidate(db, candidateId, {
    discoveryStatus: "REJECTED",
    rejectedAt: new Date(),
    errorMessage: reason,
  });

  await writeAuditLog(db, {
    actorType: audit?.actorId ? "USER" : "WORKER",
    actorId: audit?.actorId,
    action: "CANDIDATE_AUTO_REJECT",
    entityType: "candidate",
    entityId: candidateId,
    before: { discoveryStatus: candidate.discoveryStatus },
    after: { discoveryStatus: "REJECTED", rule },
    reason,
    requestId: audit?.requestId,
  });

  return updated;
}
