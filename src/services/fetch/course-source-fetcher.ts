import {
  classifyCertificateFromText,
} from "@/domain/verification/certificate-status";
import { createEvidence, type EvidenceRecord } from "@/domain/verification/evidence";
import { classifyFreeStatusFromText } from "@/domain/verification/free-status";
import { normalizeUrl } from "@/lib/url";
import {
  allowDeepTextExtraction,
  canFetchHtml,
  resolveProviderFetchPolicy,
  type ProviderFetchPolicy,
} from "@/services/fetch/provider-fetch-policy";
import {
  extractPageMetadata,
  type ExtractedMetadata,
} from "@/services/fetch/metadata-extractor";
import {
  safeHttpGet,
  type SafeHttpFetchOptions,
} from "@/services/fetch/safe-http-client";

export type CourseSourceResult = {
  status: "ok" | "skipped" | "error";
  requestedUrl: string;
  finalUrl: string | null;
  contentType: string | null;
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  images: string[];
  structuredData: Record<string, unknown>[];
  textExcerpt: string;
  evidence: EvidenceRecord[];
  fetchedAt: Date;
  warnings: string[];
  errors: string[];
  policy: ProviderFetchPolicy;
  redirectChain: string[];
  httpStatus: number | null;
};

export type CourseSourceFetcherOptions = SafeHttpFetchOptions & {
  providerSlug?: string | null;
};

function maybeNormalize(url: string | null): string | null {
  if (!url) return null;
  try {
    return normalizeUrl(url);
  } catch {
    return url;
  }
}

function appendClassificationEvidence(
  text: string,
  sourceUrl: string,
  provider: string | null | undefined,
  evidence: EvidenceRecord[],
): void {
  if (!text.trim()) return;

  const free = classifyFreeStatusFromText(text);
  if (free.matchedSignals.length > 0 || free.confidence > 0) {
    evidence.push(
      createEvidence({
        type: "PRICE",
        sourceUrl,
        sourceProvider: provider ?? null,
        observedValue: `${free.priceType}: ${free.rationale}`,
        confidence: free.confidence,
        method: "PAGE_METADATA",
      }),
    );
  }

  const certificate = classifyCertificateFromText(text);
  if (certificate.matchedSignals.length > 0 || certificate.confidence > 0) {
    evidence.push(
      createEvidence({
        type: "CERTIFICATE",
        sourceUrl,
        sourceProvider: provider ?? null,
        observedValue: `${certificate.certificateType}: ${certificate.rationale}`,
        confidence: certificate.confidence,
        method: "PAGE_METADATA",
      }),
    );
  }
}

/**
 * Safely fetch a discovered course URL and extract metadata/evidence.
 * Never throws for remote failures — returns structured result.
 */
export async function fetchCourseSource(
  requestedUrl: string,
  options: CourseSourceFetcherOptions = {},
): Promise<CourseSourceResult> {
  const policy = resolveProviderFetchPolicy({
    providerSlug: options.providerSlug,
    url: requestedUrl,
  });
  const fetchedAt = new Date();
  const base: CourseSourceResult = {
    status: "error",
    requestedUrl,
    finalUrl: null,
    contentType: null,
    title: null,
    description: null,
    canonicalUrl: null,
    images: [],
    structuredData: [],
    textExcerpt: "",
    evidence: [],
    fetchedAt,
    warnings: [],
    errors: [],
    policy,
    redirectChain: [],
    httpStatus: null,
  };

  if (!canFetchHtml(policy)) {
    return {
      ...base,
      status: "skipped",
      warnings: [`policy_${policy.fetch}`],
      errors: policy.fetch === "NO_FETCH" ? ["fetch_forbidden_by_policy"] : [],
    };
  }

  const http = await safeHttpGet(requestedUrl, options);
  if (!http.ok) {
    return {
      ...base,
      status: "error",
      finalUrl: http.finalUrl ?? null,
      httpStatus: http.status ?? null,
      redirectChain: http.redirectChain,
      fetchedAt: http.fetchedAt,
      errors: [http.reason],
    };
  }

  let extracted: ExtractedMetadata;
  try {
    extracted = extractPageMetadata({
      html: http.body,
      baseUrl: http.finalUrl,
      sourceProvider: options.providerSlug,
      includeDeepText: allowDeepTextExtraction(policy),
    });
  } catch {
    return {
      ...base,
      status: "error",
      finalUrl: http.finalUrl,
      contentType: http.contentType,
      httpStatus: http.status,
      redirectChain: http.redirectChain,
      fetchedAt: http.fetchedAt,
      errors: ["metadata_extraction_failed"],
    };
  }

  const evidence = [...extracted.evidence];
  const classificationText = [
    extracted.title,
    extracted.description,
    extracted.textExcerpt,
  ]
    .filter(Boolean)
    .join("\n");
  appendClassificationEvidence(
    classificationText,
    http.finalUrl,
    options.providerSlug,
    evidence,
  );

  // Canonical must stay on an acceptable domain relative to request when possible
  let canonicalUrl = maybeNormalize(extracted.canonicalUrl);
  if (canonicalUrl) {
    try {
      const requestedHost = new URL(requestedUrl).hostname.replace(/^www\./, "");
      const canonicalHost = new URL(canonicalUrl).hostname.replace(/^www\./, "");
      if (
        requestedHost &&
        canonicalHost &&
        requestedHost !== canonicalHost &&
        !canonicalHost.endsWith(`.${requestedHost}`) &&
        !requestedHost.endsWith(`.${canonicalHost}`)
      ) {
        extracted.warnings.push("canonical_cross_domain_ignored");
        canonicalUrl = maybeNormalize(http.finalUrl);
      }
    } catch {
      canonicalUrl = maybeNormalize(http.finalUrl);
    }
  } else {
    canonicalUrl = maybeNormalize(http.finalUrl);
  }

  return {
    status: "ok",
    requestedUrl,
    finalUrl: http.finalUrl,
    contentType: http.contentType,
    title: extracted.title,
    description: extracted.description,
    canonicalUrl,
    images: extracted.images,
    structuredData: extracted.jsonLd,
    textExcerpt: extracted.textExcerpt,
    evidence,
    fetchedAt: http.fetchedAt,
    warnings: extracted.warnings,
    errors: [],
    policy,
    redirectChain: http.redirectChain,
    httpStatus: http.status,
  };
}
