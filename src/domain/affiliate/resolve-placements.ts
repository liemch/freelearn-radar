import type { Db } from "@/db";
import { listActiveAffiliateProductsForContext } from "@/db/repositories/affiliate-product-repository";
import { listEnabledAffiliateOffers } from "@/db/repositories/affiliate-repository";
import {
  resolveAffiliateDestination,
  buildTrackedAffiliatePath,
  disclosureLabel,
} from "@/domain/affiliate/affiliate-link-service";
import { isCommerceGroupRelevant } from "@/domain/affiliate/commerce-relevance";
import { validateAffiliateProductUrl } from "@/domain/affiliate/affiliate-product";
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
  productId?: string;
  merchant?: "SHOPEE" | "LAZADA";
  imageUrl?: string | null;
  displayPrice?: string | null;
  shopName?: string | null;
};

export function isMonetizationEnabled(): boolean {
  try {
    const env = getServerEnv();
    return env.FEATURE_MONETIZATION === "true";
  } catch {
    return process.env.FEATURE_MONETIZATION === "true";
  }
}

export async function resolveCommerceProducts(
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
  if (!isCommerceAffiliateEnabled()) return [];

  try {
    const rows = await listActiveAffiliateProductsForContext(db, input);
    const cards: ResolvedAffiliateCard[] = [];
    for (const row of rows) {
      try {
        validateAffiliateProductUrl(
          row.product.destinationUrl,
          row.product.merchant,
        );
      } catch {
        continue;
      }

      const query = new URLSearchParams({
        product: row.product.id,
        placement: row.context.placementKey,
        locale: input.locale,
      });
      if (input.courseSlug) query.set("course", input.courseSlug);
      if (input.topicSlug) query.set("topic", input.topicSlug);

      cards.push({
        title: row.product.title,
        providerKey:
          row.provider?.providerKey ?? row.product.merchant.toLowerCase(),
        providerType: "COMMERCE",
        campaignKey: row.product.id,
        productId: row.product.id,
        placementKey: row.context.placementKey,
        href: `/go/affiliate?${query.toString()}`,
        disclosure:
          input.locale === "vi" ? "Liên kết tiếp thị" : "Affiliate link",
        productGroup: row.product.productCategory,
        merchant: row.product.merchant,
        imageUrl: row.product.imageUrl,
        displayPrice: row.product.displayPrice,
        shopName: row.product.shopName,
      });
      if (cards.length >= (input.limit ?? 3)) break;
    }
    return cards;
  } catch (error) {
    logger.warn("affiliate.products.resolve", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return [];
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
