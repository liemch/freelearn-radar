import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/db";
import {
  findCampaignByKey,
  recordAffiliateClick,
} from "@/db/repositories/affiliate-repository";
import { findAffiliateProductById } from "@/db/repositories/affiliate-product-repository";
import { findCourseBySlug } from "@/db/repositories/course-repository";
import { resolveAffiliateDestination } from "@/domain/affiliate/affiliate-link-service";
import {
  isAffiliateProductActive,
  validateAffiliateProductUrl,
} from "@/domain/affiliate/affiliate-product";
import {
  isCommerceAffiliateEnabled,
  isMonetizationEnabled,
} from "@/domain/affiliate/resolve-placements";
import { trackProductEvent } from "@/domain/analytics/product-events";
import { logger } from "@/lib/logger";
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/lib/i18n/config";

/**
 * Both the cookie and the query parameter are attacker-controllable, so neither
 * may reach a redirect target unvalidated: `?locale=/evil.com` would otherwise
 * resolve `/${locale}` to `//evil.com` and leave the origin.
 */
function resolveSafeLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && isLocale(cookie)) {
    return cookie;
  }
  const param = request.nextUrl.searchParams.get("locale");
  if (param && isLocale(param)) {
    return param;
  }
  return defaultLocale;
}

/**
 * Affiliate outbound hop. Tracking failure never blocks a valid redirect.
 */
export async function GET(request: NextRequest) {
  const locale = resolveSafeLocale(request);

  if (!isMonetizationEnabled()) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  const campaignKey = request.nextUrl.searchParams.get("campaign");
  const productId = request.nextUrl.searchParams.get("product");
  const placementKey =
    request.nextUrl.searchParams.get("placement") ?? "UNKNOWN";
  const courseSlug = request.nextUrl.searchParams.get("course");
  const topicSlug = request.nextUrl.searchParams.get("topic");

  if (!campaignKey && !productId) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  try {
    const db = getDb();
    if (productId) {
      if (!isCommerceAffiliateEnabled()) {
        return NextResponse.redirect(new URL(`/${locale}`, request.url));
      }
      const row = await findAffiliateProductById(db, productId);
      if (!row || !isAffiliateProductActive(row.product)) {
        return NextResponse.redirect(new URL(`/${locale}`, request.url));
      }

      let destination: string;
      try {
        destination = validateAffiliateProductUrl(
          row.product.destinationUrl,
          row.product.merchant,
        );
      } catch (error) {
        logger.error("affiliate.go.product", {
          status: "unsafe_destination",
          productId,
          error: error instanceof Error ? error.message : "unsafe",
        });
        return NextResponse.redirect(new URL(`/${locale}`, request.url));
      }

      let courseId: string | null = null;
      if (courseSlug) {
        try {
          courseId = (await findCourseBySlug(db, courseSlug))?.id ?? null;
        } catch {
          courseId = null;
        }
      }

      try {
        await recordAffiliateClick(db, {
          providerKey:
            row.provider?.providerKey ?? row.product.merchant.toLowerCase(),
          productId: row.product.id,
          placementKey,
          courseId,
          topicSlug,
          locale,
          destinationHost: new URL(destination).hostname,
        });
      } catch (error) {
        logger.warn("affiliate.go.product", {
          status: "click_record_failed",
          error: error instanceof Error ? error.message : "unknown",
        });
      }

      trackProductEvent({
        event: "affiliate_click",
        path: "/go/affiliate",
        meta: {
          providerKey:
            row.provider?.providerKey ?? row.product.merchant.toLowerCase(),
          productId,
          placementKey,
        },
      });
      return NextResponse.redirect(destination, 302);
    }

    if (!campaignKey) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
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
        locale,
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
