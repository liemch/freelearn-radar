import { createHash } from "node:crypto";

import type { Db } from "@/db";
import type { Course, CourseObservation, Provider } from "@/db/schema";
import { insertObservation } from "@/db/repositories/observation-repository";
import { updateCourse } from "@/db/repositories/course-repository";
import type { CertificateType, PriceType } from "@/domain/course/types";
import { classifyCertificateFromText } from "@/domain/verification/certificate-status";
import { classifyFreeStatusFromText } from "@/domain/verification/free-status";
import { getServerEnv } from "@/lib/env";
import {
  fetchCourseSource,
  type CourseSourceFetcherOptions,
  type CourseSourceResult,
} from "@/services/fetch/course-source-fetcher";
import {
  resolveProviderFetchPolicy,
} from "@/services/fetch/provider-fetch-policy";

export type ObservationFetchStatus =
  | "OK"
  | "NOT_FOUND"
  | "BLOCKED"
  | "TIMEOUT"
  | "ERROR";

export type TrackingTier = "HIGH" | "NORMAL" | "LOW" | "DORMANT";

export type ObserveCourseOptions = CourseSourceFetcherOptions & {
  workerVersion?: string;
  now?: Date;
  observedRegion?: string | null;
};

export type CourseForObservation = Course & {
  provider?: Pick<Provider, "id" | "slug" | "domain" | "name">;
};

const FREE_LIKE: ReadonlySet<PriceType> = new Set([
  "FREE_FULL",
  "FREE_AUDIT",
  "FREE_WITH_COUPON",
  "TEMPORARILY_FREE",
]);

export function isFreeLikePrice(priceType: PriceType | null | undefined): boolean {
  return priceType != null && FREE_LIKE.has(priceType);
}

export function nextObservationDelayHours(tier: TrackingTier): number {
  switch (tier) {
    case "HIGH":
      return 6;
    case "LOW":
      return 72;
    case "DORMANT":
      return 168;
    case "NORMAL":
    default:
      return 24;
  }
}

export function computeNextObservationAt(
  tier: TrackingTier,
  from: Date = new Date(),
): Date {
  return new Date(
    from.getTime() + nextObservationDelayHours(tier) * 60 * 60 * 1000,
  );
}

/**
 * Map fetcher outcome / HTTP failure reason → observation fetch_status.
 * Exported for unit tests.
 */
export function mapFetchResultToStatus(
  result: Pick<CourseSourceResult, "status" | "httpStatus" | "errors" | "policy">,
): ObservationFetchStatus {
  if (result.status === "ok") {
    return "OK";
  }

  if (result.status === "skipped" || result.policy.fetch === "NO_FETCH") {
    return "BLOCKED";
  }

  const reason = result.errors[0] ?? "";
  const httpStatus = result.httpStatus;

  if (
    reason === "http_404" ||
    reason === "http_410" ||
    httpStatus === 404 ||
    httpStatus === 410
  ) {
    return "NOT_FOUND";
  }

  if (reason === "timeout") {
    return "TIMEOUT";
  }

  if (
    reason === "http_403" ||
    reason === "http_429" ||
    reason === "fetch_forbidden_by_policy" ||
    httpStatus === 403 ||
    httpStatus === 429
  ) {
    return "BLOCKED";
  }

  return "ERROR";
}

function pickExtractionMethod(
  result: CourseSourceResult,
  fetchStatus: ObservationFetchStatus,
): NewObservationFields["extractionMethod"] {
  if (result.policy.fetch === "NO_FETCH" || fetchStatus === "BLOCKED") {
    if (result.status === "skipped") return "POLICY";
  }
  if (result.structuredData.length > 0) return "JSON_LD";
  if (result.title || result.description) return "OG";
  if (result.textExcerpt) return "HTML_META";
  return "HTML_META";
}

type NewObservationFields = {
  extractionMethod:
    | "JSON_LD"
    | "OG"
    | "HTML_META"
    | "PROVIDER_API"
    | "SEARCH"
    | "AI"
    | "MANUAL"
    | "POLICY";
};

function extractClassifications(result: CourseSourceResult): {
  priceType: PriceType | null;
  certificateType: CertificateType | null;
  confidence: string | null;
  evidenceSnippet: string | null;
} {
  if (result.status !== "ok") {
    return {
      priceType: null,
      certificateType: null,
      confidence: null,
      evidenceSnippet: null,
    };
  }

  const text = [result.title, result.description, result.textExcerpt]
    .filter(Boolean)
    .join("\n");

  const price = classifyFreeStatusFromText(text);
  const certificate = classifyCertificateFromText(text);
  const confidence = Math.max(price.confidence, certificate.confidence);

  return {
    priceType: price.priceType === "UNKNOWN" && price.confidence === 0
      ? null
      : price.priceType,
    certificateType:
      certificate.certificateType === "UNKNOWN" && certificate.confidence === 0
        ? null
        : certificate.certificateType,
    confidence: confidence > 0 ? confidence.toFixed(3) : null,
    evidenceSnippet: text.slice(0, 500) || null,
  };
}

function contentHash(result: CourseSourceResult): string | null {
  const payload = [
    result.finalUrl ?? "",
    result.title ?? "",
    result.description ?? "",
    result.textExcerpt.slice(0, 2000),
  ].join("|");
  if (!payload.replace(/\|/g, "")) return null;
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Observe a single course: fetch (respecting provider policy), append observation,
 * bump schedule. Does not create price events.
 */
export async function observeCourse(
  db: Db,
  course: CourseForObservation,
  options: ObserveCourseOptions = {},
): Promise<CourseObservation> {
  const env = getServerEnv();
  const now = options.now ?? new Date();
  const workerVersion =
    options.workerVersion ?? env.MONITOR_WORKER_VERSION ?? "m19.5";
  const providerSlug = course.provider?.slug ?? null;

  const policy = resolveProviderFetchPolicy({
    providerSlug,
    url: course.canonicalUrl,
  });

  let result: CourseSourceResult;

  if (policy.fetch === "NO_FETCH") {
    result = {
      status: "skipped",
      requestedUrl: course.canonicalUrl,
      finalUrl: null,
      contentType: null,
      title: null,
      description: null,
      canonicalUrl: null,
      images: [],
      structuredData: [],
      textExcerpt: "",
      evidence: [],
      fetchedAt: now,
      warnings: [`policy_${policy.fetch}`],
      errors: ["fetch_forbidden_by_policy"],
      policy,
      redirectChain: [],
      httpStatus: null,
    };
  } else {
    // METADATA_ONLY and FETCH_ALLOWED both go through fetchCourseSource
    result = await fetchCourseSource(course.canonicalUrl, {
      providerSlug,
      timeoutMs: options.timeoutMs ?? env.SOURCE_FETCH_TIMEOUT_MS,
      maxRedirects: options.maxRedirects ?? env.SOURCE_MAX_REDIRECTS,
      maxBytes: options.maxBytes ?? env.SOURCE_MAX_RESPONSE_BYTES,
      fetchImpl: options.fetchImpl,
    });
  }

  const fetchStatus = mapFetchResultToStatus(result);
  const classifications =
    fetchStatus === "OK"
      ? extractClassifications(result)
      : {
          priceType: null,
          certificateType: null,
          confidence: null,
          evidenceSnippet: null,
        };

  const observation = await insertObservation(db, {
    courseId: course.id,
    observedAt: result.fetchedAt ?? now,
    fetchStatus,
    httpStatus: result.httpStatus,
    finalUrl: result.finalUrl,
    contentHash: fetchStatus === "OK" ? contentHash(result) : null,
    etag: null,
    priceType: classifications.priceType,
    priceAmount: null,
    currency: null,
    observedRegion: options.observedRegion ?? null,
    certificateType: classifications.certificateType,
    enrollmentOpen: null,
    evidenceUrl: result.finalUrl ?? course.canonicalUrl,
    evidenceSnippet: classifications.evidenceSnippet,
    extractionMethod: pickExtractionMethod(result, fetchStatus),
    confidence: classifications.confidence,
    fetchPolicyUsed: result.policy.fetch ?? policy.fetch,
    workerVersion,
  });

  const tier = (course.trackingTier ?? "NORMAL") as TrackingTier;
  await updateCourse(db, course.id, {
    lastObservedAt: observation.observedAt,
    nextObservationAt: computeNextObservationAt(tier, now),
  });

  return observation;
}
