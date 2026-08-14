import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/db";
import {
  findCampaignByKey,
  recordAffiliateClick,
} from "@/db/repositories/affiliate-repository";
import { findCourseBySlug } from "@/db/repositories/course-repository";
import { resolveAffiliateDestination } from "@/domain/affiliate/affiliate-link-service";
import {
  isMonetizationEnabled,
} from "@/domain/affiliate/resolve-placements";
import { trackProductEvent } from "@/domain/analytics/product-events";
import { logger } from "@/lib/logger";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

/**
 * Affiliate outbound hop. Tracking failure never blocks a valid redirect.
 */
export async function GET(request: NextRequest) {
  const localeCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale =
    (localeCookie && isLocale(localeCookie) ? localeCookie : null) ||
    request.nextUrl.searchParams.get("locale") ||
    defaultLocale;

  if (!isMonetizationEnabled()) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  const campaignKey = request.nextUrl.searchParams.get("campaign");
  const placementKey =
    request.nextUrl.searchParams.get("placement") ?? "UNKNOWN";
  const courseSlug = request.nextUrl.searchParams.get("course");
  const topicSlug = request.nextUrl.searchParams.get("topic");

  if (!campaignKey) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  try {
    const db = getDb();
    const row = await findCampaignByKey(db, campaignKey);
    if (
      !row ||
      !row.campaign.enabled ||
      !row.provider.enabled
    ) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }

    let destination: string;
    try {
      destination = resolveAffiliateDestination({
        template: row.campaign.destinationTemplate,
        allowedHosts: row.provider.allowedHosts ?? [],
      });
    } catch (error) {
      logger.error("affiliate.go", {
        status: "unsafe_destination",
        campaignKey,
        error: error instanceof Error ? error.message : "unsafe",
      });
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }

    let courseId: string | null = null;
    if (courseSlug) {
      try {
        const course = await findCourseBySlug(db, courseSlug);
        courseId = course?.id ?? null;
      } catch {
        courseId = null;
      }
    }

    try {
      await recordAffiliateClick(db, {
        providerKey: row.provider.providerKey,
        campaignId: row.campaign.id,
        placementKey,
        courseId,
        topicSlug,
        locale: typeof locale === "string" ? locale : defaultLocale,
        destinationHost: new URL(destination).hostname,
      });
    } catch (error) {
      logger.warn("affiliate.go", {
        status: "click_record_failed",
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    trackProductEvent({
      event: "affiliate_click",
      path: "/go/affiliate",
      meta: {
        providerKey: row.provider.providerKey,
        campaignKey,
        placementKey,
      },
    });

    return NextResponse.redirect(destination, 302);
  } catch (error) {
    logger.error("affiliate.go", {
      status: "error",
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }
}
