import type { PriceType } from "@/domain/course/types";
import {
  daysSince,
  getVerificationIntervalDays,
} from "@/domain/verification/freshness-policy";

export type RecheckPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export type RecheckPriorityInput = {
  lastVerifiedAt?: Date | null;
  priceType: PriceType;
  providerSlug?: string | null;
  ratingCount?: number | null;
  previousVerificationFailed?: boolean;
  hasUnknownPrice?: boolean;
  hasUnknownCertificate?: boolean;
  now?: Date;
};

export type RecheckPriorityResult = {
  priority: RecheckPriority;
  score: number;
  reasons: string[];
  overdueDays: number;
};

export function computeRecheckPriority(
  input: RecheckPriorityInput,
): RecheckPriorityResult {
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  let score = 0;

  const interval = getVerificationIntervalDays({
    priceType: input.priceType,
    providerSlug: input.providerSlug,
  });

  let overdueDays = 0;
  if (!input.lastVerifiedAt) {
    overdueDays = interval + 30;
    score += 40;
    reasons.push("Never verified");
  } else {
    const age = daysSince(input.lastVerifiedAt, now);
    overdueDays = Math.max(0, age - interval);
    if (overdueDays > 0) {
      score += Math.min(50, 20 + overdueDays * 2);
      reasons.push(`Overdue by ${Math.floor(overdueDays)} days`);
    }
  }

  if (input.priceType === "FREE_WITH_COUPON") {
    score += 35;
    reasons.push("Coupon promotion");
  } else if (input.priceType === "TEMPORARILY_FREE") {
    score += 30;
    reasons.push("Temporary free");
  } else if (input.priceType === "FREE_TRIAL") {
    score += 20;
    reasons.push("Free trial");
  } else if (input.priceType === "UNKNOWN") {
    score += 15;
    reasons.push("Unknown price");
  }

  if (input.previousVerificationFailed) {
    score += 25;
    reasons.push("Previous failure");
  }

  if (input.hasUnknownPrice) {
    score += 10;
  }
  if (input.hasUnknownCertificate) {
    score += 5;
  }

  const popularity = input.ratingCount ?? 0;
  if (popularity >= 1000) {
    score += 15;
    reasons.push("High popularity");
  } else if (popularity >= 100) {
    score += 8;
  }

  let priority: RecheckPriority = "LOW";
  if (score >= 70) priority = "CRITICAL";
  else if (score >= 45) priority = "HIGH";
  else if (score >= 25) priority = "NORMAL";

  return { priority, score, reasons, overdueDays };
}

export function compareRecheckPriority(
  a: RecheckPriorityResult,
  b: RecheckPriorityResult,
): number {
  return b.score - a.score;
}
