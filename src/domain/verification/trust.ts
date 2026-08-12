import type {
  CertificateType,
  PriceType,
} from "@/domain/course/types";
import { daysSince } from "@/domain/verification/freshness-policy";

export type TrustState =
  | "VERIFIED"
  | "LIKELY_VALID"
  | "NEEDS_REVIEW"
  | "STALE"
  | "UNVERIFIED";

export type TrustSignals = {
  lastVerifiedAt?: Date | null;
  verificationSucceeded?: boolean;
  verificationFailed?: boolean;
  priceType: PriceType;
  certificateType: CertificateType;
  pricingConfidence: number;
  certificateConfidence: number;
  metadataCompleteness: number;
  sourceScore: number;
  now?: Date;
};

export type TrustAssessment = {
  trustScore: number;
  state: TrustState;
  verificationScore: number;
  metadataScore: number;
  sourceScore: number;
  pricingConfidence: number;
  certificateConfidence: number;
  reasons: string[];
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function assessCourseTrust(signals: TrustSignals): TrustAssessment {
  const now = signals.now ?? new Date();
  const reasons: string[] = [];

  let verificationScore = 15;
  if (!signals.lastVerifiedAt) {
    verificationScore = 10;
    reasons.push("Never verified");
  } else {
    const age = daysSince(signals.lastVerifiedAt, now);
    if (signals.verificationFailed) {
      verificationScore = 20;
      reasons.push("Last verification failed");
    } else if (age <= 7) {
      verificationScore = 95;
    } else if (age <= 14) {
      verificationScore = 80;
    } else if (age <= 30) {
      verificationScore = 55;
      reasons.push("Verification aging");
    } else {
      verificationScore = 25;
      reasons.push("Verification stale");
    }
  }

  const metadataScore = clamp(signals.metadataCompleteness);
  const sourceScore = clamp(signals.sourceScore);
  const pricingConfidence = clamp(signals.pricingConfidence * 100);
  const certificateConfidence = clamp(signals.certificateConfidence * 100);

  if (signals.priceType === "UNKNOWN") {
    reasons.push("Price type unknown");
  }
  if (signals.certificateType === "UNKNOWN") {
    reasons.push("Certificate type unknown");
  }
  if (pricingConfidence < 50) {
    reasons.push("Low pricing confidence");
  }

  const trustScore = clamp(
    verificationScore * 0.35 +
      metadataScore * 0.15 +
      sourceScore * 0.15 +
      pricingConfidence * 0.2 +
      certificateConfidence * 0.15,
  );

  let state: TrustState = "LIKELY_VALID";

  if (!signals.lastVerifiedAt) {
    state = "UNVERIFIED";
  } else if (
    signals.verificationFailed ||
    pricingConfidence < 40 ||
    (signals.priceType === "UNKNOWN" && certificateConfidence < 40)
  ) {
    state = "NEEDS_REVIEW";
  } else if (verificationScore <= 30) {
    state = "STALE";
  } else if (
    verificationScore >= 80 &&
    pricingConfidence >= 70 &&
    signals.priceType !== "UNKNOWN"
  ) {
    state = "VERIFIED";
  } else {
    state = "LIKELY_VALID";
  }

  return {
    trustScore,
    state,
    verificationScore,
    metadataScore,
    sourceScore,
    pricingConfidence,
    certificateConfidence,
    reasons,
  };
}

/** Ranking multiplier for trust state (deterministic penalty, not LLM). */
export function trustRankingMultiplier(state: TrustState): number {
  switch (state) {
    case "VERIFIED":
      return 1;
    case "LIKELY_VALID":
      return 0.92;
    case "NEEDS_REVIEW":
      return 0.7;
    case "STALE":
      return 0.55;
    case "UNVERIFIED":
      return 0.5;
    default:
      return 0.8;
  }
}
