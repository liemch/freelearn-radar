import type { PriceType } from "@/domain/course/types";

/** Provider freshness profiles — centralized, not scattered hardcodes. */
export type ProviderFreshnessProfile = {
  /** Multiplier on base interval (<1 = check more often). */
  intervalMultiplier: number;
  label: string;
};

const PROVIDER_PROFILES: Record<string, ProviderFreshnessProfile> = {
  "microsoft-learn": { intervalMultiplier: 1.5, label: "stable docs" },
  freecodecamp: { intervalMultiplier: 1.4, label: "stable free catalog" },
  udemy: { intervalMultiplier: 0.7, label: "volatile promotions" },
  coursera: { intervalMultiplier: 1.0, label: "standard" },
  edx: { intervalMultiplier: 1.0, label: "standard" },
};

/** Base recheck interval in days by price type. */
const BASE_INTERVAL_DAYS: Record<PriceType, number> = {
  FREE_WITH_COUPON: 2,
  TEMPORARILY_FREE: 3,
  FREE_TRIAL: 5,
  FREE_AUDIT: 14,
  FREE_FULL: 21,
  PAID: 30,
  UNKNOWN: 7,
};

export function getProviderFreshnessProfile(
  providerSlug?: string | null,
): ProviderFreshnessProfile {
  if (!providerSlug) {
    return { intervalMultiplier: 1, label: "default" };
  }
  return (
    PROVIDER_PROFILES[providerSlug] ?? {
      intervalMultiplier: 1,
      label: "default",
    }
  );
}

export function getVerificationIntervalDays(input: {
  priceType: PriceType;
  providerSlug?: string | null;
}): number {
  const base = BASE_INTERVAL_DAYS[input.priceType] ?? 14;
  const profile = getProviderFreshnessProfile(input.providerSlug);
  return Math.max(1, Math.round(base * profile.intervalMultiplier));
}

export function daysSince(from: Date, now = new Date()): number {
  return (now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

export function isVerificationDue(input: {
  lastVerifiedAt?: Date | null;
  priceType: PriceType;
  providerSlug?: string | null;
  now?: Date;
}): boolean {
  if (!input.lastVerifiedAt) {
    return true;
  }
  const interval = getVerificationIntervalDays({
    priceType: input.priceType,
    providerSlug: input.providerSlug,
  });
  return daysSince(input.lastVerifiedAt, input.now) >= interval;
}

type VerificationAgeLabels = {
  never: string;
  today: string;
  yesterday: string;
  daysAgo: (days: number) => string;
};

const DEFAULT_AGE_LABELS: VerificationAgeLabels = {
  never: "Never verified",
  today: "Verified today",
  yesterday: "Verified yesterday",
  daysAgo: (days) => `Last verified ${days} days ago`,
};

export function verificationAgeLabel(
  lastVerifiedAt: Date | null | undefined,
  now = new Date(),
  labels: VerificationAgeLabels = DEFAULT_AGE_LABELS,
): string {
  if (!lastVerifiedAt) {
    return labels.never;
  }
  const days = Math.floor(daysSince(lastVerifiedAt, now));
  if (days <= 0) return labels.today;
  if (days === 1) return labels.yesterday;
  return labels.daysAgo(days);
}

export function isStaleForPublicWarning(
  lastVerifiedAt: Date | null | undefined,
  priceType: PriceType,
  now = new Date(),
): boolean {
  if (!lastVerifiedAt) return true;
  const interval = getVerificationIntervalDays({ priceType });
  return daysSince(lastVerifiedAt, now) > interval * 1.5;
}
