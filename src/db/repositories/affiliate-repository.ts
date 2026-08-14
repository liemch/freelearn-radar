import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  affiliateCampaigns,
  affiliateClicks,
  affiliatePlacements,
  affiliateProviders,
  type AffiliateCampaign,
  type AffiliatePlacement,
  type AffiliateProvider,
} from "@/db/schema";

export type AffiliateOffer = {
  provider: AffiliateProvider;
  campaign: AffiliateCampaign;
  placement: AffiliatePlacement;
  destination: string;
};

export async function listAffiliateProviders(db: Db) {
  return db.select().from(affiliateProviders).orderBy(affiliateProviders.providerKey);
}

export async function listEnabledAffiliateOffers(
  db: Db,
  input: {
    placementKey: string;
    topicSlug?: string | null;
    categorySlug?: string | null;
    courseId?: string | null;
    locale?: string | null;
    now?: Date;
  },
): Promise<
  Array<{
    provider: AffiliateProvider;
    campaign: AffiliateCampaign;
    placement: AffiliatePlacement;
  }>
> {
  const now = input.now ?? new Date();

  const rows = await db
    .select({
      provider: affiliateProviders,
      campaign: affiliateCampaigns,
      placement: affiliatePlacements,
    })
    .from(affiliatePlacements)
    .innerJoin(
      affiliateCampaigns,
      eq(affiliatePlacements.campaignId, affiliateCampaigns.id),
    )
    .innerJoin(
      affiliateProviders,
      eq(affiliateCampaigns.affiliateProviderId, affiliateProviders.id),
    )
    .where(
      and(
        eq(affiliatePlacements.placementKey, input.placementKey),
        eq(affiliatePlacements.enabled, true),
        eq(affiliateCampaigns.enabled, true),
        eq(affiliateProviders.enabled, true),
        or(
          isNull(affiliateCampaigns.startsAt),
          lte(affiliateCampaigns.startsAt, now),
        ),
        or(
          isNull(affiliateCampaigns.endsAt),
          gte(affiliateCampaigns.endsAt, now),
        ),
      ),
    )
    .orderBy(affiliatePlacements.priority);

  return rows.filter((row) => {
    if (
      row.placement.topicSlug &&
      input.topicSlug &&
      row.placement.topicSlug !== input.topicSlug
    ) {
      return false;
    }
    if (
      row.placement.categorySlug &&
      input.categorySlug &&
      row.placement.categorySlug !== input.categorySlug
    ) {
      return false;
    }
    if (
      row.placement.courseId &&
      input.courseId &&
      row.placement.courseId !== input.courseId
    ) {
      return false;
    }
    if (
      row.placement.locale &&
      input.locale &&
      row.placement.locale !== input.locale
    ) {
      return false;
    }
    // Unscoped placements (null topic/category/course) always match.
    return true;
  });
}

export async function findCampaignByKey(db: Db, campaignKey: string) {
  const rows = await db
    .select({
      campaign: affiliateCampaigns,
      provider: affiliateProviders,
    })
    .from(affiliateCampaigns)
    .innerJoin(
      affiliateProviders,
      eq(affiliateCampaigns.affiliateProviderId, affiliateProviders.id),
    )
    .where(eq(affiliateCampaigns.campaignKey, campaignKey))
    .limit(1);
  return rows[0] ?? null;
}

export async function recordAffiliateClick(
  db: Db,
  input: {
    providerKey: string;
    campaignId?: string | null;
    placementKey: string;
    courseId?: string | null;
    topicSlug?: string | null;
    locale?: string | null;
    destinationHost?: string | null;
  },
) {
  await db.insert(affiliateClicks).values({
    providerKey: input.providerKey,
    campaignId: input.campaignId ?? null,
    placementKey: input.placementKey,
    courseId: input.courseId ?? null,
    topicSlug: input.topicSlug ?? null,
    locale: input.locale ?? null,
    destinationHost: input.destinationHost ?? null,
  });
}

export async function affiliateClickStats(db: Db, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db
    .select({
      providerKey: affiliateClicks.providerKey,
      placementKey: affiliateClicks.placementKey,
      count: sql<number>`count(*)::int`,
    })
    .from(affiliateClicks)
    .where(gte(affiliateClicks.clickedAt, since))
    .groupBy(affiliateClicks.providerKey, affiliateClicks.placementKey)
    .orderBy(desc(sql`count(*)`));
}
