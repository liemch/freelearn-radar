/**
 * Privacy-conscious product analytics abstraction.
 * Logs structured events only — no raw PII, no third-party SDKs.
 */

import { logger } from "@/lib/logger";

export type ProductEventName =
  | "course_view"
  | "course_outbound_click"
  | "affiliate_click"
  | "search"
  | "category_view"
  | "provider_view"
  | "topic_view"
  | "collection_view";

export type ProductEventPayload = {
  event: ProductEventName;
  path?: string;
  courseId?: string;
  courseSlug?: string;
  categorySlug?: string;
  providerSlug?: string;
  query?: string;
  resultCount?: number;
  /** Never pass emails, IPs, or raw user agents here. */
  meta?: Record<string, string | number | boolean | null | undefined>;
};

export function trackProductEvent(payload: ProductEventPayload): void {
  const safeQuery =
    payload.query && payload.query.length > 80
      ? `${payload.query.slice(0, 80)}…`
      : payload.query;

  logger.info("product.event", {
    ...payload,
    query: safeQuery ?? undefined,
  });
}
