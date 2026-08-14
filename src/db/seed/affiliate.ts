import type { Db } from "@/db";
import {
  affiliateCampaigns,
  affiliatePlacements,
  affiliateProviders,
} from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Seed disabled-by-default affiliate providers/campaigns.
 * Kill switch FEATURE_MONETIZATION must also be true before anything renders.
 */
export async function seedAffiliateMonetization(db: Db) {
  const seeds = [
    {
      providerKey: "coursera-affiliate",
      providerType: "COURSE" as const,
      displayName: "Coursera",
      allowedHosts: ["coursera.org"],
      disclosureTextVi: "Liên kết tiếp thị",
      disclosureTextEn: "Affiliate link",
      campaigns: [
        {
          campaignKey: "coursera-next-step",
          name: "Coursera — bước học tiếp theo",
          destinationTemplate: "https://www.coursera.org/",
          productGroup: null,
          placements: [
            {
              placementKey: "COURSE_DETAIL_RELATED_LEARNING",
              priority: 10,
            },
            {
              placementKey: "LEARNING_PATH_RESOURCES",
              priority: 20,
            },
          ],
        },
      ],
    },
    {
      providerKey: "shopee-learning",
      providerType: "COMMERCE" as const,
      displayName: "Shopee Learning Gear",
      allowedHosts: ["shopee.vn", "shopee.com"],
      disclosureTextVi: "Liên kết tiếp thị",
      disclosureTextEn: "Affiliate link",
      campaigns: [
        {
          campaignKey: "shopee-programming-books",
          name: "Sách lập trình gợi ý",
          destinationTemplate: "https://shopee.vn/search?keyword=sach%20lap%20trinh",
          productGroup: "BOOK" as const,
          placements: [
            {
              placementKey: "COURSE_DETAIL_RELATED_LEARNING",
              topicSlug: "programming",
              priority: 30,
            },
            {
              placementKey: "TOPIC_LEARNING_RESOURCES",
              topicSlug: "programming",
              priority: 10,
            },
          ],
        },
      ],
    },
  ];

  for (const seed of seeds) {
    const existing = await db
      .select()
      .from(affiliateProviders)
      .where(eq(affiliateProviders.providerKey, seed.providerKey))
      .limit(1);

    let providerId = existing[0]?.id;
    if (!providerId) {
      const inserted = await db
        .insert(affiliateProviders)
        .values({
          providerKey: seed.providerKey,
          providerType: seed.providerType,
          displayName: seed.displayName,
          allowedHosts: seed.allowedHosts,
          enabled: false,
          disclosureRequired: true,
          disclosureTextVi: seed.disclosureTextVi,
          disclosureTextEn: seed.disclosureTextEn,
        })
        .returning();
      providerId = inserted[0]!.id;
    }

    for (const campaign of seed.campaigns) {
      const existingCampaign = await db
        .select()
        .from(affiliateCampaigns)
        .where(eq(affiliateCampaigns.campaignKey, campaign.campaignKey))
        .limit(1);

      let campaignId = existingCampaign[0]?.id;
      if (!campaignId) {
        const inserted = await db
          .insert(affiliateCampaigns)
          .values({
            affiliateProviderId: providerId,
            name: campaign.name,
            campaignKey: campaign.campaignKey,
            destinationTemplate: campaign.destinationTemplate,
            productGroup: campaign.productGroup,
            enabled: false,
          })
          .returning();
        campaignId = inserted[0]!.id;
      }

      for (const placement of campaign.placements) {
        const existingPlacement = await db
          .select()
          .from(affiliatePlacements)
          .where(
            eq(affiliatePlacements.placementKey, placement.placementKey),
          )
          .limit(5);

        const already = existingPlacement.some(
          (row) =>
            row.campaignId === campaignId &&
            (row.topicSlug ?? null) ===
              ("topicSlug" in placement ? placement.topicSlug ?? null : null),
        );
        if (already) continue;

        await db.insert(affiliatePlacements).values({
          campaignId,
          placementKey: placement.placementKey,
          topicSlug:
            "topicSlug" in placement ? (placement.topicSlug ?? null) : null,
          priority: placement.priority,
          enabled: false,
        });
      }
    }
  }
}
