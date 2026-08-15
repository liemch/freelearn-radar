/**
 * Deterministic fixtures for runtime verification.
 *
 * Inserts through the real Drizzle schema so column types, enums, defaults and
 * constraints are all exercised. No fabricated verification state: anything that
 * production derives from evidence is left at its default here and is only set
 * by the code under test.
 */

import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import {
  categories,
  courseCategories,
  courses,
  couponSources,
  providers,
  providerPolicies,
  topicTags,
  courseTopicTags,
  discoveryQueries,
  users,
} from "@/db/schema";

export type SeededIds = {
  providerIds: Record<string, string>;
  categoryIds: Record<string, string>;
  courseIds: Record<string, string>;
};

const PROVIDERS = [
  { slug: "udemy", name: "Udemy", domain: "udemy.com" },
  { slug: "coursera", name: "Coursera", domain: "coursera.org" },
  { slug: "microsoft-learn", name: "Microsoft Learn", domain: "learn.microsoft.com" },
];

const CATEGORIES = [
  { slug: "programming", name: "Lập trình" },
  { slug: "ai", name: "AI" },
  { slug: "soft-skills", name: "Kỹ năng mềm" },
  { slug: "design", name: "Thiết kế & Sáng tạo" },
  { slug: "finance", name: "Tài chính" },
  { slug: "office-productivity", name: "Văn phòng & Công việc" },
];

/**
 * Course fixtures chosen to cover every access type plus the Vietnamese search
 * cases (accented, unaccented, cross-language) and the exact-title case.
 */
const COURSES = [
  {
    key: "python-free",
    slug: "python-cho-nguoi-moi",
    title: "Khóa học Python cho người mới bắt đầu",
    provider: "udemy",
    category: "programming",
    priceType: "FREE_FULL" as const,
    certificateType: "FREE_CERTIFICATE" as const,
    level: "BEGINNER" as const,
    durationMinutes: 120,
    language: "Vietnamese",
    qualityScore: 90,
  },
  {
    key: "cs50",
    slug: "cs50-introduction-to-programming-with-python",
    title: "CS50's Introduction to Programming with Python",
    provider: "coursera",
    category: "programming",
    priceType: "FREE_AUDIT" as const,
    certificateType: "PAID_CERTIFICATE" as const,
    level: "BEGINNER" as const,
    durationMinutes: 600,
    language: "English",
    qualityScore: 95,
  },
  {
    key: "project-management",
    slug: "project-management-fundamentals",
    title: "Project Management Fundamentals",
    provider: "coursera",
    category: "soft-skills",
    priceType: "FREE_AUDIT" as const,
    certificateType: "PAID_CERTIFICATE" as const,
    level: "INTERMEDIATE" as const,
    durationMinutes: 300,
    language: "English",
    qualityScore: 80,
  },
  {
    key: "paid-python",
    slug: "advanced-python-masterclass",
    title: "Advanced Python Masterclass",
    provider: "udemy",
    category: "programming",
    priceType: "PAID" as const,
    certificateType: "PAID_CERTIFICATE" as const,
    level: "ADVANCED" as const,
    durationMinutes: 900,
    language: "English",
    qualityScore: 99,
  },
  {
    key: "trial-python",
    slug: "python-bootcamp-trial",
    title: "Python Bootcamp Free Trial",
    provider: "udemy",
    category: "programming",
    priceType: "FREE_TRIAL" as const,
    certificateType: "PAID_CERTIFICATE" as const,
    level: "BEGINNER" as const,
    durationMinutes: 240,
    language: "English",
    qualityScore: 98,
  },
  {
    key: "preview-python",
    slug: "python-preview-only",
    title: "Python Preview Only Course",
    provider: "coursera",
    category: "programming",
    priceType: "FREE_PREVIEW" as const,
    certificateType: "UNKNOWN" as const,
    level: "BEGINNER" as const,
    durationMinutes: 60,
    language: "English",
    qualityScore: 97,
  },
  {
    key: "coupon-design",
    slug: "graphic-design-with-canva",
    title: "Graphic Design with Canva",
    provider: "udemy",
    category: "design",
    priceType: "FREE_WITH_COUPON" as const,
    certificateType: "FREE_CERTIFICATE" as const,
    level: "BEGINNER" as const,
    durationMinutes: 180,
    language: "English",
    qualityScore: 70,
  },
  {
    key: "temp-free-excel",
    slug: "excel-co-ban-mien-phi",
    title: "Excel cơ bản miễn phí",
    provider: "microsoft-learn",
    category: "office-productivity",
    priceType: "TEMPORARILY_FREE" as const,
    certificateType: "FREE_CERTIFICATE" as const,
    level: "BEGINNER" as const,
    durationMinutes: 90,
    language: "Vietnamese",
    qualityScore: 75,
  },
  {
    key: "ai-beginners",
    slug: "ai-for-beginners",
    title: "AI for Beginners",
    provider: "microsoft-learn",
    category: "ai",
    priceType: "FREE_FULL" as const,
    certificateType: "FREE_CERTIFICATE" as const,
    level: "BEGINNER" as const,
    durationMinutes: 150,
    language: "English",
    qualityScore: 88,
  },
  {
    key: "unpublished",
    slug: "draft-course-not-live",
    title: "Draft Course Not Live",
    provider: "udemy",
    category: "programming",
    priceType: "FREE_FULL" as const,
    certificateType: "FREE_CERTIFICATE" as const,
    level: "BEGINNER" as const,
    durationMinutes: 100,
    language: "English",
    qualityScore: 100,
    status: "DRAFT" as const,
  },
];

export async function seedFixtures(db: Db): Promise<SeededIds> {
  const now = new Date();
  const providerIds: Record<string, string> = {};
  const categoryIds: Record<string, string> = {};
  const courseIds: Record<string, string> = {};

  for (const provider of PROVIDERS) {
    const [row] = await db
      .insert(providers)
      .values({
        slug: provider.slug,
        name: provider.name,
        domain: provider.domain,
        active: true,
      })
      .returning();
    providerIds[provider.slug] = row!.id;

    await db.insert(providerPolicies).values({
      providerId: row!.id,
      priceType: "FREE_FULL",
      certificateType: "FREE_CERTIFICATE",
      policyNote: "verification fixture",
      active: true,
    });
  }

  for (const category of CATEGORIES) {
    const [row] = await db
      .insert(categories)
      .values({
        slug: category.slug,
        name: category.name,
        description: `${category.name} — fixture`,
      })
      .returning();
    categoryIds[category.slug] = row!.id;
  }

  for (const course of COURSES) {
    const canonicalUrl = `https://${
      PROVIDERS.find((p) => p.slug === course.provider)!.domain
    }/course/${course.slug}`;

    const [row] = await db
      .insert(courses)
      .values({
        slug: course.slug,
        title: course.title,
        description: `${course.title} — fixture description`,
        shortDescription: course.title,
        providerId: providerIds[course.provider]!,
        canonicalUrl,
        outboundUrl: canonicalUrl,
        language: course.language,
        level: course.level,
        durationMinutes: course.durationMinutes,
        priceType: course.priceType,
        certificateType: course.certificateType,
        qualityScore: course.qualityScore,
        status: course.status ?? "PUBLISHED",
        publishedAt: now,
        lastVerifiedAt: now,
      })
      .returning();

    courseIds[course.key] = row!.id;
    await db.insert(courseCategories).values({
      courseId: row!.id,
      categoryId: categoryIds[course.category]!,
    });
  }

  return { providerIds, categoryIds, courseIds };
}

export async function seedTopicTag(
  db: Db,
  slug: string,
  nameVi: string,
  courseId: string,
  categoryId: string | null,
): Promise<string> {
  const [tag] = await db
    .insert(topicTags)
    .values({ slug, nameVi, nameEn: slug, categoryId })
    .returning();
  await db.insert(courseTopicTags).values({ courseId, tagId: tag!.id });
  return tag!.id;
}

export async function seedDiscoveryQueries(
  db: Db,
  entries: Array<{ query: string; provider: string; category: string }>,
): Promise<void> {
  for (const entry of entries) {
    await db.insert(discoveryQueries).values({
      query: entry.query,
      provider: entry.provider,
      category: entry.category,
      enabled: true,
    });
  }
}

export async function seedCouponSource(
  db: Db,
  overrides?: { sourceKey?: string; enabled?: boolean; baseUrl?: string },
): Promise<string> {
  const [row] = await db
    .insert(couponSources)
    .values({
      sourceKey: overrides?.sourceKey ?? "fixture-source",
      name: "Fixture Coupon Source",
      sourceType: "HTML",
      baseUrl: overrides?.baseUrl ?? "https://coupons.example.com/udemy",
      enabled: overrides?.enabled ?? true,
      priority: 1,
    })
    .returning();
  return row!.id;
}

export async function seedAdminUser(db: Db, email: string): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({
      email,
      name: "Verification Admin",
      role: "ADMIN",
      passwordHash: "$2b$10$fixtureonlyfixtureonlyfixtureonlyfixtureonlyfix",
    })
    .returning();
  return row!.id;
}

export async function courseBySlug(db: Db, slug: string) {
  const rows = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}
