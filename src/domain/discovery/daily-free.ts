/**
 * M21.7 — Daily free ("Miễn phí hôm nay") query service.
 * Prefer verified ACTIVE_100_OFF offers; fall back to limited free price types.
 * Never includes FREE_PREVIEW / FREE_TRIAL.
 */

import type { Db } from "@/db";
import type { CourseWithProvider } from "@/db/repositories/course-repository";
import { listPublishedCoursesWithProvider } from "@/db/repositories/course-repository";
import { listActive100OffOffers } from "@/db/repositories/coupon-repository";
import { isDailyFreeEligibleAccess } from "@/domain/access/access-classifier";
import { isPublicCoupon100Off } from "@/domain/coupon/coupon-service";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import { rankCourses } from "@/domain/ranking/ranking";

export type DailyFreeItem = {
  course: CourseWithProvider;
  offerStatus: "ACTIVE_100_OFF" | "TEMPORARILY_FREE" | "FREE_WITH_COUPON" | null;
  offerUrl: string | null;
  couponCode: string | null;
  verifiedAt: Date | null;
  categorySlug: string | null;
  /**
   * True only when an offer row was verified 100% off against the provider.
   * The fallback branch below has no offer-level verification, so it must not
   * borrow the verified "Coupon 100%" label (§120).
   */
  couponVerified: boolean;
};

function formatRelativeVi(from: Date, now = new Date()): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - from.getTime()) / 60_000),
  );
  if (minutes < 1) return "Vừa xác minh";
  if (minutes < 60) return `Xác minh ${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Xác minh ${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `Xác minh ${days} ngày trước`;
}

export function formatVerificationFreshnessVi(
  verifiedAt: Date | null,
  now = new Date(),
): string | null {
  if (!verifiedAt) return null;
  return formatRelativeVi(verifiedAt, now);
}

export async function queryDailyFreeDeals(
  db: Db,
  options?: { limit?: number; now?: Date },
): Promise<DailyFreeItem[]> {
  const limit = options?.limit ?? 48;
  const now = options?.now ?? new Date();
  const activeOffers = await listActive100OffOffers(db, limit, now);
  const fromOffers: DailyFreeItem[] = [];

  for (const row of activeOffers) {
    if (!row.course || row.course.status !== "PUBLISHED") continue;
    if (!row.provider) continue;
    if (!isEligibleForFreeLists(row.course.priceType)) continue;
    if (!isPublicCoupon100Off(row.offer.status)) continue;
    // Re-assert expiry here: the repository filters it, but an expired coupon
    // reaching a public surface is severe enough to check twice.
    if (
      row.offer.expiresAt &&
      row.offer.expiresAt.getTime() <= now.getTime()
    ) {
      continue;
    }

    const course: CourseWithProvider = {
      ...row.course,
      provider: row.provider,
    };

    fromOffers.push({
      course,
      offerStatus: "ACTIVE_100_OFF",
      offerUrl: row.offer.offerUrl,
      couponCode: row.offer.couponCode,
      verifiedAt: row.offer.verifiedAt,
      categorySlug: null,
      couponVerified: true,
    });
  }

  if (fromOffers.length >= Math.min(6, limit)) {
    return fromOffers.slice(0, limit);
  }

  const published = await listPublishedCoursesWithProvider(db, 120);
  const fallback = rankCourses(
    published.filter(
      (c) =>
        isEligibleForFreeLists(c.priceType) &&
        isDailyFreeEligibleAccess(c.priceType) &&
        // A FREE_WITH_COUPON course reaches this branch precisely because it has
        // no live verified offer — its coupon may have expired, been withdrawn,
        // or never been checked. §126.4 removes an expired coupon from this
        // surface rather than relabelling it, and there is no evidence here to
        // distinguish "coupon still works" from "coupon is gone".
        c.priceType !== "FREE_WITH_COUPON",
    ),
  );

  const seen = new Set(fromOffers.map((i) => i.course.id));
  for (const course of fallback) {
    if (seen.has(course.id)) continue;
    fromOffers.push({
      course,
      offerStatus:
        course.priceType === "TEMPORARILY_FREE" ? "TEMPORARILY_FREE" : null,
      offerUrl: course.outboundUrl,
      couponCode: null,
      verifiedAt: course.lastVerifiedAt,
      categorySlug: null,
      couponVerified: false,
    });
    if (fromOffers.length >= limit) break;
  }

  return fromOffers;
}

export function groupDailyFreeByCategory(
  items: DailyFreeItem[],
  categoryByCourseId: Map<string, string>,
): Map<string, DailyFreeItem[]> {
  const groups = new Map<string, DailyFreeItem[]>();
  for (const item of items) {
    const key =
      item.categorySlug ??
      categoryByCourseId.get(item.course.id) ??
      "khac";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}
