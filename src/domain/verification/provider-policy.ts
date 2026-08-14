import type {
  CertificateType,
  PriceType,
} from "@/domain/course/types";
import {
  classifyCertificateFromText,
  type CertificateClassification,
} from "@/domain/verification/certificate-status";

export type PriceTypeSource = "AI" | "SEARCH" | "POLICY" | "MANUAL";

export type ProviderPolicyRule = {
  providerSlug: string;
  priceType: PriceType;
  certificateType: CertificateType;
  evidenceUrl?: string | null;
  policyNote?: string | null;
  /** A policy dated in the future does not yet govern classification (§66.2). */
  effectiveFrom?: Date | null;
  active?: boolean;
};

/**
 * Seeded provider certificate policies (project plan §66.2).
 * Evidence URLs point at published provider policy pages.
 */
export const SEED_PROVIDER_POLICIES: ProviderPolicyRule[] = [
  {
    providerSlug: "udemy",
    priceType: "FREE_FULL",
    certificateType: "NO_CERTIFICATE",
    evidenceUrl:
      "https://support.udemy.com/hc/en-us/articles/360040701614-The-Free-Course-Experience",
    policyNote:
      "Udemy free-tier courses do not include a certificate of completion",
    active: true,
  },
  {
    providerSlug: "udemy",
    priceType: "FREE_WITH_COUPON",
    certificateType: "FREE_CERTIFICATE",
    evidenceUrl:
      "https://support.udemy.com/hc/en-us/articles/1500010482202-Free-Courses-What-Should-Instructors-Know",
    policyNote:
      "Coupon / gift access to a paid Udemy course includes paid-tier features including certificate",
    active: true,
  },
  {
    providerSlug: "microsoft-learn",
    priceType: "FREE_FULL",
    certificateType: "NO_CERTIFICATE",
    evidenceUrl: "https://learn.microsoft.com/training/",
    policyNote:
      "Microsoft Learn modules are free to complete but do not issue completion certificates the same way as paid cert exams",
    active: true,
  },
  {
    providerSlug: "freecodecamp",
    priceType: "FREE_FULL",
    certificateType: "FREE_CERTIFICATE",
    evidenceUrl: "https://www.freecodecamp.org/learn/",
    policyNote: "freeCodeCamp issues free certificates on curriculum completion",
    active: true,
  },
  {
    providerSlug: "coursera",
    priceType: "FREE_AUDIT",
    certificateType: "PAID_CERTIFICATE",
    evidenceUrl:
      "https://www.coursera.support/s/article/209819033-Audit-a-course",
    policyNote:
      "Coursera audit gives free access to course content; the certificate requires payment",
    active: true,
  },
  {
    providerSlug: "edx",
    priceType: "FREE_AUDIT",
    certificateType: "PAID_CERTIFICATE",
    evidenceUrl: "https://www.edx.org/verified-certificate",
    policyNote:
      "edX audit track gives free access to course content; the verified certificate requires payment",
    active: true,
  },
];

/**
 * FREE_WITH_COUPON may only be set via MANUAL (project plan M19.1).
 */
export function assertPriceTypeAllowed(
  source: PriceTypeSource,
  priceType: PriceType,
): void {
  if (priceType === "FREE_WITH_COUPON" && source !== "MANUAL") {
    throw new Error(
      `FREE_WITH_COUPON may only be set via MANUAL (got source=${source})`,
    );
  }
}

/**
 * §66.4: an audit-model course always has a certificate story — either the
 * certificate is paid, or there is none. Leaving it UNKNOWN publishes a page that
 * cannot answer the question a visitor came to ask, so the value must be resolved
 * before the pairing is written.
 *
 * Deliberately not auto-filled: guessing PAID_CERTIFICATE for an unrecognised
 * provider would assert a fact the system has no evidence for. Provider policy
 * covers the known cases; everything else is escalated to a human.
 */
export function assertCertificateResolved(
  priceType: PriceType,
  certificateType: CertificateType,
): void {
  if (priceType === "FREE_AUDIT" && certificateType === "UNKNOWN") {
    throw new Error(
      "FREE_AUDIT requires a resolved certificate type (§66.4); set it explicitly or add a provider policy",
    );
  }
}

/**
 * Certificate resolution order per project plan §66.3:
 * 1. MANUAL — skipped (caller short-circuits)
 * 2. provider_policies (deterministic)
 * 3. page evidence (classifyCertificateFromText)
 * 4. AI only when confidence ≥ 0.8
 * 5. UNKNOWN
 */
export function resolveCertificateWithPolicy(input: {
  providerSlug?: string | null;
  priceType?: PriceType | null;
  evidenceText: string;
  aiSuggestion?: CertificateType | null;
  aiConfidence?: number | null;
  policies?: ProviderPolicyRule[];
  now?: Date;
}): CertificateClassification {
  const now = input.now ?? new Date();
  const policies = (input.policies ?? SEED_PROVIDER_POLICIES).filter(
    (policy) =>
      policy.active !== false &&
      (!policy.effectiveFrom || policy.effectiveFrom <= now),
  );
  const slug = (input.providerSlug ?? "").toLowerCase().trim();
  const priceType = input.priceType ?? null;

  if (slug && priceType) {
    const match = policies.find(
      (policy) =>
        policy.providerSlug === slug && policy.priceType === priceType,
    );
    if (match) {
      return {
        certificateType: match.certificateType,
        confidence: 0.95,
        rationale:
          match.policyNote ??
          `Provider policy: ${slug} + ${priceType} → ${match.certificateType}`,
        matchedSignals: ["provider_policy"],
      };
    }
  }

  const evidence = classifyCertificateFromText(input.evidenceText);

  if (
    evidence.certificateType !== "UNKNOWN" &&
    evidence.confidence >= 0.7
  ) {
    return evidence;
  }

  const ai = input.aiSuggestion;
  const aiConf = input.aiConfidence ?? 0;

  // Weak/refusal evidence already refused classification — do not let AI upgrade.
  if (
    evidence.matchedSignals.length > 0 &&
    evidence.certificateType === "UNKNOWN" &&
    ai &&
    ai !== "UNKNOWN" &&
    aiConf >= 0.8
  ) {
    return {
      ...evidence,
      rationale: `${evidence.rationale} (AI suggested ${ai}; rejected because deterministic evidence already refused this classification)`,
    };
  }

  if (
    ai &&
    ai !== "UNKNOWN" &&
    aiConf >= 0.8 &&
    evidence.certificateType === "UNKNOWN" &&
    evidence.matchedSignals.length === 0
  ) {
    return {
      certificateType: ai,
      confidence: Math.min(aiConf, 0.75),
      rationale: `Adopting AI suggestion ${ai} (confidence ≥ 0.8)`,
      matchedSignals: [],
    };
  }

  if (evidence.certificateType === "UNKNOWN") {
    return evidence;
  }

  return {
    certificateType: "UNKNOWN",
    confidence: 0.2,
    rationale: "Insufficient certificate evidence",
    matchedSignals: evidence.matchedSignals,
  };
}
