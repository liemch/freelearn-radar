/**
 * Seed data for the HTTP walkthrough.
 *
 * Built on the shared catalog fixtures, plus the rows the public and admin
 * surfaces need in order to render something real: a verified 100%-off offer, an
 * expired one, topic tags, an admin user with a known password, and a
 * monetization provider/campaign for the outbound tests.
 */

import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import {
  affiliateCampaigns,
  affiliateProviders,
  courseOffers,
  courses,
  providers,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

import {
  seedAdminUser,
  seedCouponSource,
  seedDiscoveryQueries,
  seedFixtures,
  seedTopicTag,
} from "./fixtures";

export const ADMIN_EMAIL = "verify-admin@example.com";
export const ADMIN_PASSWORD = "VerifyAdminPassword123!";

export async function seedHttpFixtures(db: Db) {
  const ids = await seedFixtures(db);

  const udemy = (
    await db.select().from(providers).where(eq(providers.slug, "udemy")).limit(1)
  )[0]!;

  // A verified, live 100%-off offer so "Miễn phí hôm nay" has real content.
  const canvaCourse = (
    await db
      .select()
      .from(courses)
      .where(eq(courses.slug, "graphic-design-with-canva"))
      .limit(1)
  )[0]!;

  const now = new Date();
  await db.insert(courseOffers).values({
    courseId: canvaCourse.id,
    providerId: udemy.id,
    providerSlug: "udemy",
    canonicalUrl: canvaCourse.canonicalUrl,
    offerUrl: `${canvaCourse.canonicalUrl}?couponCode=VERIFYLIVE`,
    couponCode: "VERIFYLIVE",
    offerType: "COUPON",
    status: "ACTIVE_100_OFF",
    discountPercent: 100,
    discoveredFrom: "verification-fixture",
    discoveredAt: now,
    verifiedAt: now,
    expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
    nextRecheckAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
  });

  // An expired offer that must never surface.
  const excelCourse = (
    await db
      .select()
      .from(courses)
      .where(eq(courses.slug, "excel-co-ban-mien-phi"))
      .limit(1)
  )[0]!;
  await db.insert(courseOffers).values({
    courseId: excelCourse.id,
    providerId: excelCourse.providerId,
    providerSlug: "microsoft-learn",
    canonicalUrl: excelCourse.canonicalUrl,
    offerUrl: `${excelCourse.canonicalUrl}?couponCode=EXPIREDONE`,
    couponCode: "EXPIREDONE",
    offerType: "COUPON",
    status: "ACTIVE_100_OFF",
    discountPercent: 100,
    discoveredFrom: "verification-fixture",
    discoveredAt: now,
    verifiedAt: now,
    expiresAt: new Date(now.getTime() - 60 * 60 * 1000),
  });

  await seedTopicTag(
    db,
    "python",
    "Python",
    ids.courseIds["python-free"]!,
    ids.categoryIds.programming!,
  );

  await seedCouponSource(db, {
    sourceKey: "verify-source",
    baseUrl: "https://coupons.invalid/udemy",
    enabled: false,
  });

  await seedDiscoveryQueries(db, [
    { query: "site:udemy.com python free", provider: "udemy", category: "programming" },
    { query: "site:udemy.com thiet ke mien phi", provider: "udemy", category: "design" },
  ]);

  const adminId = await seedAdminUser(db, ADMIN_EMAIL);
  await db
    .update(
      // Password hash must be real so the login route can verify it.
      (await import("@/db/schema")).users,
    )
    .set({ passwordHash: await hashPassword(ADMIN_PASSWORD) })
    .where(eq((await import("@/db/schema")).users.id, adminId));

  // Monetization fixtures. No real affiliate credentials: the destination is a
  // plain provider URL and the tracking template contains no partner id.
  const [affProvider] = await db
    .insert(affiliateProviders)
    .values({
      providerKey: "coursera",
      providerType: "COURSE",
      displayName: "Coursera",
      enabled: true,
      allowedHosts: ["coursera.org"],
      disclosureTextVi: "Liên kết tiếp thị",
      disclosureTextEn: "Affiliate link",
    })
    .returning();

  await db.insert(affiliateCampaigns).values({
    affiliateProviderId: affProvider!.id,
    name: "Verification campaign",
    campaignKey: "verify-course",
    destinationTemplate: "https://www.coursera.org/browse",
    enabled: true,
  });

  const [disabledProvider] = await db
    .insert(affiliateProviders)
    .values({
      providerKey: "shopee",
      providerType: "COMMERCE",
      displayName: "Shopee",
      enabled: false,
      allowedHosts: ["shopee.vn"],
      disclosureTextVi: "Liên kết tiếp thị",
    })
    .returning();

  await db.insert(affiliateCampaigns).values({
    affiliateProviderId: disabledProvider!.id,
    name: "Disabled commerce campaign",
    campaignKey: "verify-commerce-disabled",
    destinationTemplate: "https://shopee.vn/search?keyword=sach%20python",
    enabled: true,
  });

  // A campaign whose destination is not on the provider allowlist.
  await db.insert(affiliateCampaigns).values({
    affiliateProviderId: affProvider!.id,
    name: "Off-allowlist campaign",
    campaignKey: "verify-bad-host",
    destinationTemplate: "https://evil.example.com/steal",
    enabled: true,
  });

  return {
    courses: Object.keys(ids.courseIds).length,
    categories: Object.keys(ids.categoryIds).length,
    providers: Object.keys(ids.providerIds).length,
    offers: 2,
    adminEmail: ADMIN_EMAIL,
  };
}
