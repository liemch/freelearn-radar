import type { Db } from "@/db";
import { listEnabledAffiliateOffers } from "@/db/repositories/affiliate-repository";
import {
  resolveAffiliateDestination,
  buildTrackedAffiliatePath,
  disclosureLabel,
} from "@/domain/affiliate/affiliate-link-service";
import { isCommerceGroupRelevant } from "@/domain/affiliate/commerce-relevance";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export const PLACEMENT_KEYS = {
  COURSE_DETAIL_RELATED_LEARNING: "COURSE_DETAIL_RELATED_LEARNING",
  LEARNING_PATH_RESOURCES: "LEARNING_PATH_RESOURCES",
  TOPIC_LEARNING_RESOURCES: "TOPIC_LEARNING_RESOURCES",
} as const;

export type ResolvedAffiliateCard = {
  title: string;
  providerKey: string;
  providerType: "COURSE" | "COMMERCE";
  campaignKey: string;
  placementKey: string;
  href: string;
  disclosure: string;
  productGroup: string | null;
};

export function isMonetizationEnabled(): boolean {
  try {
    const env = getServerEnv();
    return env.FEATURE_MONETIZATION === "true";
  } catch {
    return process.env.FEATURE_MONETIZATION === "true";
  }
}

export function isCourseAffiliateEnabled(): boolean {
  try {
    const env = getServerEnv();
    return (
      env.FEATURE_MONETIZATION === "true" &&
      env.FEATURE_COURSE_AFFILIATE === "true"
    );
  } catch {
    return (
      process.env.FEATURE_MONETIZATION === "true" &&
      process.env.FEATURE_COURSE_AFFILIATE === "true"
    );
  }
}

export function isCommerceAffiliateEnabled(): boolean {
  try {
    const env = getServerEnv();
    return (
      env.FEATURE_MONETIZATION === "true" &&
      env.FEATURE_COMMERCE_AFFILIATE === "true"
    );
  } catch {
    return (
      process.env.FEATURE_MONETIZATION === "true" &&
      process.env.FEATURE_COMMERCE_AFFILIATE === "true"
    );
  }
}

/**
 * Resolve contextual affiliate cards. Returns [] when flags are OFF or on error.
 * Never throws into the page — monetization must not break core UX (§113.8).
 */
export async function resolveAffiliatePlacements(
  db: Db,
  input: {
    placementKey: string;
    locale: string;
    topicSlug?: string | null;
    categorySlug?: string | null;
    courseId?: string | null;
    courseSlug?: string | null;
    limit?: number;
  },
): Promise<ResolvedAffiliateCard[]> {
  if (!isMonetizationEnabled()) return [];

  try {
    const offers = await listEnabledAffiliateOffers(db, {
      placementKey: input.placementKey,
      topicSlug: input.topicSlug,
      categorySlug: input.categorySlug,
      courseId: input.courseId,
      locale: input.locale,
    });

    const cards: ResolvedAffiliateCard[] = [];
    for (const offer of offers) {
      if (
        offer.provider.providerType === "COURSE" &&
        !isCourseAffiliateEnabled()
      ) {
        continue;
      }
      if (offer.provider.providerType === "COMMERCE") {
        if (!isCommerceAffiliateEnabled()) continue;
        if (
          !isCommerceGroupRelevant(
            offer.campaign.productGroup,
            input.topicSlug ?? input.categorySlug,
          )
        ) {
          continue;
        }
      }

      try {
        // Validate destination now so broken campaigns never render.
        resolveAffiliateDestination({
          template: offer.campaign.destinationTemplate,
          allowedHosts: offer.provider.allowedHosts ?? [],
        });
      } catch {
        continue;
      }

      cards.push({
        title: offer.campaign.name,
        providerKey: offer.provider.providerKey,
        providerType: offer.provider.providerType,
        campaignKey: offer.campaign.campaignKey,
        placementKey: offer.placement.placementKey,
        href: buildTrackedAffiliatePath({
          campaignKey: offer.campaign.campaignKey,
          placementKey: offer.placement.placementKey,
          courseSlug: input.courseSlug,
          topicSlug: input.topicSlug,
          locale: input.locale,
        }),
        disclosure: disclosureLabel(input.locale, offer.provider),
        productGroup: offer.campaign.productGroup,
      });

      if (cards.length >= (input.limit ?? 3)) break;
    }

    return cards;
  } catch (error) {
    logger.warn("affiliate.resolve", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}
