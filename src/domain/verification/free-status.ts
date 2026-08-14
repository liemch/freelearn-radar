import type { PriceType } from "@/domain/course/types";
import {
  findCatalogFreePricePolicy,
  type ProviderPolicyRule,
} from "@/domain/verification/provider-policy";

export type FreeStatusClassification = {
  priceType: PriceType;
  confidence: number;
  rationale: string;
  matchedSignals: string[];
};

function includesAny(text: string, patterns: RegExp[]): string[] {
  return patterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);
}

/**
 * Conservative free-status classifier.
 * Ambiguous marketing language must NOT become FREE_FULL.
 */
export function classifyFreeStatusFromText(
  raw: string,
): FreeStatusClassification {
  const text = raw.toLowerCase().replace(/\s+/g, " ").trim();

  if (!text) {
    return {
      priceType: "UNKNOWN",
      confidence: 0,
      rationale: "Empty evidence text",
      matchedSignals: [],
    };
  }

  const paidSignals = includesAny(text, [
    /\bpurchase\b/,
    /\bbuy now\b/,
    /\bprice:\s*\$?[1-9]/,
    /\bfrom \$?[1-9]/,
    /\b\$\d+(\.\d+)?\b/,
    /\bpaid course\b/,
    /\bpremium only\b/,
  ]);

  const couponSignals = includesAny(text, [
    /\bcoupon\b/,
    /\bpromo code\b/,
    /\bdiscount code\b/,
    /\b100% off\b/,
    /\bfree with coupon\b/,
  ]);

  const trialSignals = includesAny(text, [
    /\bfree trial\b/,
    /\btry free for\b/,
    /\b\d+\s*-?\s*day free\b/,
    /\bfree for \d+ days\b/,
    /\bstart free trial\b/,
  ]);

  const temporarySignals = includesAny(text, [
    /\blimited time\b/,
    /\btemporarily free\b/,
    /\bfree this week\b/,
    /\bfree today only\b/,
    /\bends soon\b/,
    /\b\$0 today\b/,
  ]);

  const auditSignals = includesAny(text, [
    /\baudit\b/,
    /\bfree to audit\b/,
    /\baudit for free\b/,
    /\bfree enrollment\b/,
    /\benroll for free\b/,
    /\bfree to enroll\b/,
  ]);

  const previewSignals = includesAny(text, [
    /\bfree preview\b/,
    /\bfree sample\b/,
    /\bpreview lessons?\b/,
    /\btry a free lesson\b/,
  ]);

  const subscriptionSignals = includesAny(text, [
    /\bfree with subscription\b/,
    /\bincluded with\b.*\bsubscription\b/,
    /\bfree for members\b/,
    /\brequires subscription\b/,
  ]);

  const strongFullFree = includesAny(text, [
    /\bentirely free\b/,
    /\bcompletely free\b/,
    /\b100% free\b(?!.*coupon)/,
    /\bfree forever\b/,
    /\bno payment required\b/,
    /\bfree full access\b/,
    /\bfree course\b(?!.*audit)(?!.*trial)(?!.*coupon)(?!.*preview)/,
  ]);

  // Ambiguous: must not become FREE_FULL
  const ambiguousFree = includesAny(text, [
    /\bstart learning for free\b/,
    /\blearn for free\b/,
    /\bget started for free\b/,
    /\bfree to start\b/,
  ]);

  if (subscriptionSignals.length > 0) {
    return {
      priceType: "PAID",
      confidence: 0.75,
      rationale: "Free only with subscription → treat as paid access model",
      matchedSignals: subscriptionSignals,
    };
  }

  if (couponSignals.length > 0) {
    if (
      /\b(coupon expired|expired coupon|promotion ended)\b/.test(text) ||
      (paidSignals.length > 0 && /\bexpired\b/.test(text))
    ) {
      return {
        priceType: "PAID",
        confidence: 0.8,
        rationale: "Coupon/promotion expired with paid pricing signals",
        matchedSignals: [...couponSignals, ...paidSignals],
      };
    }

    return {
      priceType: "FREE_WITH_COUPON",
      confidence: 0.85,
      rationale: "Coupon / promo code required",
      matchedSignals: couponSignals,
    };
  }

  if (trialSignals.length > 0) {
    return {
      priceType: "FREE_TRIAL",
      confidence: 0.85,
      rationale: "Explicit free trial language",
      matchedSignals: trialSignals,
    };
  }

  if (previewSignals.length > 0 && strongFullFree.length === 0) {
    return {
      priceType: "UNKNOWN",
      confidence: 0.4,
      rationale: "Free preview alone is insufficient for free course status",
      matchedSignals: previewSignals,
    };
  }

  if (temporarySignals.length > 0) {
    return {
      priceType: "TEMPORARILY_FREE",
      confidence: 0.8,
      rationale: "Temporary / limited-time free promotion",
      matchedSignals: temporarySignals,
    };
  }

  if (auditSignals.length > 0) {
    return {
      priceType: "FREE_AUDIT",
      confidence: 0.8,
      rationale: "Audit / free enrollment language (not full free ownership)",
      matchedSignals: auditSignals,
    };
  }

  if (ambiguousFree.length > 0 && strongFullFree.length === 0) {
    return {
      priceType: "UNKNOWN",
      confidence: 0.35,
      rationale:
        "Ambiguous marketing free language — insufficient for FREE_FULL",
      matchedSignals: ambiguousFree,
    };
  }

  if (strongFullFree.length > 0 && paidSignals.length === 0) {
    return {
      priceType: "FREE_FULL",
      confidence: 0.75,
      rationale: "Strong full-free signals without paid contradiction",
      matchedSignals: strongFullFree,
    };
  }

  if (paidSignals.length > 0 && strongFullFree.length === 0) {
    return {
      priceType: "PAID",
      confidence: 0.7,
      rationale: "Paid pricing signals without free override",
      matchedSignals: paidSignals,
    };
  }

  if (paidSignals.length > 0 && strongFullFree.length > 0) {
    return {
      priceType: "UNKNOWN",
      confidence: 0.3,
      rationale: "Conflicting free and paid signals",
      matchedSignals: [...paidSignals, ...strongFullFree],
    };
  }

  return {
    priceType: "UNKNOWN",
    confidence: 0.2,
    rationale: "Insufficient evidence for free/paid classification",
    matchedSignals: [],
  };
}

/**
 * Merge deterministic text classification with provider policy and an optional AI
 * suggestion, in the order page evidence → provider policy → AI (§66.3).
 * Explicit page evidence always wins.
 *
 * An UNKNOWN with matched signals is a deliberate refusal (ambiguous marketing copy,
 * free preview only, conflicting signals). Neither policy nor AI may upgrade a
 * refusal into a free claim — a catalog-wide policy only answers pages that say
 * nothing about price at all.
 */
export function resolvePriceType(input: {
  evidenceText: string;
  aiSuggestion?: PriceType | null;
  aiConfidence?: number | null;
  providerSlug?: string | null;
  policies?: ProviderPolicyRule[];
  now?: Date;
}): FreeStatusClassification {
  const deterministic = classifyFreeStatusFromText(input.evidenceText);

  if (deterministic.confidence >= 0.7) {
    return deterministic;
  }

  if (
    deterministic.priceType === "UNKNOWN" &&
    deterministic.matchedSignals.length === 0
  ) {
    const policy = findCatalogFreePricePolicy({
      providerSlug: input.providerSlug,
      policies: input.policies,
      now: input.now,
    });

    if (policy) {
      return {
        priceType: policy.priceType,
        confidence: 0.8,
        rationale: `Provider policy (${policy.providerSlug}): whole catalog is ${policy.priceType}${
          policy.policyNote ? ` — ${policy.policyNote}` : ""
        }`,
        matchedSignals: ["provider_policy"],
      };
    }
  }

  const ai = input.aiSuggestion;
  const aiConf = input.aiConfidence ?? 0;

  if (
    ai &&
    ai !== "UNKNOWN" &&
    aiConf >= 0.7 &&
    deterministic.priceType === "UNKNOWN" &&
    deterministic.matchedSignals.length > 0
  ) {
    return {
      ...deterministic,
      rationale: `${deterministic.rationale} (AI suggested ${ai}; rejected because deterministic evidence already refused this classification)`,
    };
  }

  if (
    ai &&
    ai !== "UNKNOWN" &&
    aiConf >= 0.7 &&
    deterministic.priceType === "UNKNOWN"
  ) {
    return {
      priceType: ai,
      confidence: Math.min(aiConf, 0.65),
      rationale: `Weak text evidence; adopting AI suggestion ${ai} at capped confidence`,
      matchedSignals: deterministic.matchedSignals,
    };
  }

  if (
    ai &&
    deterministic.priceType !== "UNKNOWN" &&
    ai !== deterministic.priceType
  ) {
    return {
      ...deterministic,
      rationale: `${deterministic.rationale} (AI suggested ${ai} ignored due to conflict)`,
    };
  }

  return deterministic;
}
