/**
 * M21.3/11 — Bounded coupon aggregator discovery (discovery ≠ Truth).
 */

import type { Db } from "@/db";
import {
  findCouponCandidateByOfferUrl,
  insertCouponCandidate,
  listEnabledCouponSources,
  recordCouponSourceRun,
} from "@/db/repositories/coupon-repository";
import {
  extractUdemyOfferUrlsFromHtml,
  normalizeCouponCandidate,
} from "@/domain/coupon/coupon-service";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeHttpGet } from "@/services/fetch/safe-http-client";

export type CouponDiscoverySummary = {
  enabled: boolean;
  sourcesProcessed: number;
  pagesFetched: number;
  candidatesInserted: number;
  duplicatesSkipped: number;
  invalidSkipped: number;
  sourceErrors: number;
  skippedReason: string | null;
};

function emptySummary(
  partial: Partial<CouponDiscoverySummary> = {},
): CouponDiscoverySummary {
  return {
    enabled: false,
    sourcesProcessed: 0,
    pagesFetched: 0,
    candidatesInserted: 0,
    duplicatesSkipped: 0,
    invalidSkipped: 0,
    sourceErrors: 0,
    skippedReason: null,
    ...partial,
  };
}

function pageUrlsForSource(baseUrl: string, configJson: unknown): string[] {
  const pages = [baseUrl];
  if (
    configJson &&
    typeof configJson === "object" &&
    "extraPages" in configJson &&
    Array.isArray((configJson as { extraPages?: unknown }).extraPages)
  ) {
    for (const page of (configJson as { extraPages: unknown[] }).extraPages) {
      if (typeof page === "string" && page.trim()) pages.push(page.trim());
    }
  }
  return pages;
}

/**
 * Fetch enabled coupon sources and insert DISCOVERED candidates.
 * Never marks ACTIVE_100_OFF from aggregator HTML.
 */
export async function runCouponDiscovery(
  db: Db,
  options?: {
    maxPages?: number;
    maxCandidates?: number;
  },
): Promise<CouponDiscoverySummary> {
  const env = getServerEnv();
  if (env.FEATURE_COUPON_DISCOVERY !== "true") {
    return emptySummary({
      skippedReason: "FEATURE_COUPON_DISCOVERY_off",
    });
  }

  const maxPages =
    options?.maxPages ?? env.COUPON_DISCOVERY_MAX_PAGES_PER_RUN;
  const maxCandidates =
    options?.maxCandidates ?? env.COUPON_DISCOVERY_MAX_CANDIDATES;

  const summary = emptySummary({ enabled: true });
  const sources = await listEnabledCouponSources(db);
  let pagesBudget = maxPages;

  for (const source of sources) {
    if (pagesBudget <= 0 || summary.candidatesInserted >= maxCandidates) break;

    summary.sourcesProcessed += 1;
    const pages = pageUrlsForSource(source.baseUrl, source.configJson).slice(
      0,
      pagesBudget,
    );
    let insertedForSource = 0;
    let sourceOk = false;
    let sourceFailing = false;

    for (const pageUrl of pages) {
      if (summary.candidatesInserted >= maxCandidates) break;
      pagesBudget -= 1;
      summary.pagesFetched += 1;

      try {
        const http = await safeHttpGet(pageUrl, {
          timeoutMs: env.SOURCE_FETCH_TIMEOUT_MS,
          maxRedirects: env.SOURCE_MAX_REDIRECTS,
          maxBytes: env.SOURCE_MAX_RESPONSE_BYTES,
        });

        if (!http.ok) {
          sourceFailing = true;
          summary.sourceErrors += 1;
          logger.warn("coupon.discovery.source_fetch", {
            status: "error",
            sourceKey: source.sourceKey,
            pageUrl,
            reason: http.reason,
          });
          continue;
        }

        const urls = extractUdemyOfferUrlsFromHtml(http.body);
        if (urls.length === 0) {
          // HTML change / empty listing — degrade but do not invent offers.
          sourceFailing = true;
          logger.warn("coupon.discovery.empty_extract", {
            status: "degraded",
            sourceKey: source.sourceKey,
            pageUrl,
          });
          continue;
        }

        sourceOk = true;
        for (const rawUrl of urls) {
          if (summary.candidatesInserted >= maxCandidates) break;

          const normalized = normalizeCouponCandidate({
            rawUrl,
            discoveredFrom: source.sourceKey,
          });

          if (normalized.status === "INVALID" || !normalized.offerUrl) {
            summary.invalidSkipped += 1;
            continue;
          }

          const existing = await findCouponCandidateByOfferUrl(
            db,
            normalized.offerUrl,
          );
          if (existing) {
            summary.duplicatesSkipped += 1;
            continue;
          }

          const inserted = await insertCouponCandidate(db, {
            sourceId: source.id,
            providerSlug: normalized.providerSlug,
            canonicalUrl: normalized.canonicalUrl,
            offerUrl: normalized.offerUrl,
            couponCode: normalized.couponCode,
            discoveredFrom: normalized.discoveredFrom,
            sourceClaim: normalized.sourceClaim,
            sourcePrice: normalized.sourcePrice,
            sourceOriginalPrice: normalized.sourceOriginalPrice,
            sourceExpiresAt: normalized.sourceExpiresAt,
            status: "DISCOVERED",
            lastError: null,
          });
          if (!inserted) {
            // Lost the race against a concurrent run; the offer_url unique
            // index settled it, and a duplicate is not an error.
            summary.duplicatesSkipped += 1;
            continue;
          }
          summary.candidatesInserted += 1;
          insertedForSource += 1;
        }
      } catch (error) {
        sourceFailing = true;
        summary.sourceErrors += 1;
        logger.warn("coupon.discovery.source_exception", {
          status: "error",
          sourceKey: source.sourceKey,
          pageUrl,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    await recordCouponSourceRun(db, source.id, {
      healthStatus: sourceOk
        ? "HEALTHY"
        : sourceFailing
          ? "FAILING"
          : "DEGRADED",
      candidatesDiscoveredDelta: insertedForSource,
      success: sourceOk,
    });
  }

  logger.info("coupon.discovery", { status: "success", ...summary });
  return summary;
}
