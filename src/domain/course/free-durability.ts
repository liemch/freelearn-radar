import type { FreeDurability, PriceType } from "@/domain/course/types";

const PERMANENT_FREE_FULL_PROVIDERS = new Set([
  "microsoft-learn",
  "freecodecamp",
  "aws",
  "google",
]);

const AUDIT_FOREVER_PROVIDERS = new Set(["coursera", "edx"]);

const LIMITED_PRICE_TYPES = new Set<PriceType>([
  "FREE_WITH_COUPON",
  "TEMPORARILY_FREE",
  "FREE_TRIAL",
]);

/**
 * Deterministic free durability from provider + price type (project plan §66.5).
 * No AI — derived from known provider design.
 */
export function deriveFreeDurability(
  providerSlug: string | null | undefined,
  priceType: PriceType,
): FreeDurability {
  const slug = (providerSlug ?? "").toLowerCase().trim();

  if (priceType === "FREE_FULL" && PERMANENT_FREE_FULL_PROVIDERS.has(slug)) {
    return "PERMANENT";
  }

  if (priceType === "FREE_AUDIT" && AUDIT_FOREVER_PROVIDERS.has(slug)) {
    return "AUDIT_FOREVER";
  }

  if (LIMITED_PRICE_TYPES.has(priceType)) {
    return "LIMITED";
  }

  return "UNKNOWN";
}

/**
 * Price types that must never reach a free-labelled surface (project plan §66.4).
 * Single source of truth: catalog SQL, topic pages, and the monthly collection all
 * derive their exclusion from this list rather than repeating the literals.
 */
export const FREE_LIST_EXCLUDED_PRICE_TYPES: readonly PriceType[] = [
  "FREE_TRIAL",
  "PAID",
];

/**
 * FREE_TRIAL is never free; PAID is never free.
 * Used by catalog default free listings (project plan §66.4).
 */
export function isEligibleForFreeLists(priceType: PriceType): boolean {
  return !FREE_LIST_EXCLUDED_PRICE_TYPES.includes(priceType);
}

export class PublicCatalogVisibilityError extends Error {
  constructor(readonly priceType: PriceType) {
    super(publicCatalogVisibilityMessage(priceType));
    this.name = "PublicCatalogVisibilityError";
  }
}

/** Human-readable guard used by admin publish flows (EN; API layer may localize). */
export function publicCatalogVisibilityMessage(priceType: PriceType): string {
  if (priceType === "PAID") {
    return "Paid courses are not listed on the public free catalog. Change the price type to a free offer before publishing.";
  }

  if (priceType === "FREE_TRIAL") {
    return "Free-trial courses are not listed on the public free catalog. Use a full-free or audit price type before publishing.";
  }

  return `Price type ${priceType} cannot be published to the public free catalog.`;
}

export function assertVisibleOnPublicCatalog(priceType: PriceType): void {
  if (!isEligibleForFreeLists(priceType)) {
    throw new PublicCatalogVisibilityError(priceType);
  }
}
