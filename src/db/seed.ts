import "@/lib/load-env";

import { and, eq } from "drizzle-orm";

import type { Db } from "@/db";
import { createScriptDb } from "@/db/script-db";
import { createCategory } from "@/db/repositories/category-repository";
import {
  createCourse,
  findCourseBySlug,
  setCourseCategories,
} from "@/db/repositories/course-repository";
import { createDiscoveryQuery } from "@/db/repositories/discovery-query-repository";
import { createProvider } from "@/db/repositories/provider-repository";
import { createUser, findUserByEmail } from "@/db/repositories/user-repository";
import {
  categories,
  discoveryQueries,
  providerPolicies,
  providers,
} from "@/db/schema";
import {
  decideSampleCourseSeeding,
  deriveAdminName,
  deriveCategoryDescription,
  parseAdminEmails,
  RETIRED_DISCOVERY_QUERIES,
  SEED_CATEGORIES,
  SEED_DISCOVERY_QUERIES,
  SEED_PROVIDERS,
} from "@/db/seed/data";
import { SEED_COURSES } from "@/db/seed/courses";
import { deriveFreeDurability } from "@/domain/course/free-durability";
import { SEED_PROVIDER_POLICIES } from "@/domain/verification/provider-policy";
import { seedAffiliateMonetization } from "@/db/seed/affiliate";
import { seedCouponSources } from "@/db/seed/coupon-sources";
import { hashPassword } from "@/lib/auth/password";

async function seedProviders(db: Db) {
  for (const provider of SEED_PROVIDERS) {
    const existing = await db
      .select()
      .from(providers)
      .where(eq(providers.slug, provider.slug))
      .limit(1);

    if (existing[0]) {
      continue;
    }

    await createProvider(db, provider);
  }
}

async function seedProviderPolicies(db: Db) {
  const allProviders = await db.select().from(providers);
  const providerBySlug = new Map(
    allProviders.map((provider) => [provider.slug, provider]),
  );
  const now = new Date();

  for (const policy of SEED_PROVIDER_POLICIES) {
    const provider = providerBySlug.get(policy.providerSlug);
    if (!provider) {
      console.warn(
        `Skipping provider policy ${policy.providerSlug}/${policy.priceType}: provider missing`,
      );
      continue;
    }

    const existing = await db
      .select()
      .from(providerPolicies)
      .where(
        and(
          eq(providerPolicies.providerId, provider.id),
          eq(providerPolicies.priceType, policy.priceType),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(providerPolicies)
        .set({
          certificateType: policy.certificateType,
          evidenceUrl: policy.evidenceUrl ?? null,
          policyNote: policy.policyNote ?? null,
          active: policy.active !== false,
          catalogWideFree: policy.catalogWideFree === true,
          updatedAt: now,
        })
        .where(eq(providerPolicies.id, existing[0].id));
      continue;
    }

    await db.insert(providerPolicies).values({
      providerId: provider.id,
      priceType: policy.priceType,
      certificateType: policy.certificateType,
      evidenceUrl: policy.evidenceUrl ?? null,
      policyNote: policy.policyNote ?? null,
      active: policy.active !== false,
      catalogWideFree: policy.catalogWideFree === true,
      effectiveFrom: now,
      reviewedAt: now,
      reviewedBy: "seed",
    });
  }
}

async function seedCategories(db: Db) {
  for (const category of SEED_CATEGORIES) {
    const existing = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, category.slug))
      .limit(1);

    if (existing[0]) {
      continue;
    }

    await createCategory(db, {
      ...category,
      description: deriveCategoryDescription(category.name),
    });
  }
}

async function seedDiscoveryQueries(db: Db) {
  for (const query of SEED_DISCOVERY_QUERIES) {
    const existing = await db
      .select()
      .from(discoveryQueries)
      .where(eq(discoveryQueries.query, query.query))
      .limit(1);

    if (existing[0]) {
      continue;
    }

    await createDiscoveryQuery(db, query);
  }

  for (const query of RETIRED_DISCOVERY_QUERIES) {
    await db
      .update(discoveryQueries)
      .set({ enabled: false })
      .where(
        and(eq(discoveryQueries.query, query), eq(discoveryQueries.enabled, true)),
      );
  }
}

async function seedAdminUsers(db: Db) {
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (adminEmails.length === 0) {
    console.warn("ADMIN_EMAILS is empty; skipping admin user seed");
    return;
  }

  if (!bootstrapPassword) {
    console.warn(
      "ADMIN_BOOTSTRAP_PASSWORD is missing; skipping admin user seed",
    );
    return;
  }

  const passwordHash = await hashPassword(bootstrapPassword);

  for (const [index, email] of adminEmails.entries()) {
    const existing = await findUserByEmail(db, email);
    if (existing) {
      continue;
    }

    await createUser(db, {
      email,
      name: deriveAdminName(email),
      passwordHash,
      role: index === 0 ? "ADMIN" : "EDITOR",
    });
  }
}

async function seedCourses(db: Db) {
  const decision = decideSampleCourseSeeding(process.env);
  if (!decision.allowed) {
    console.warn(`Skipping sample course seed: ${decision.reason}`);
    return;
  }

  const allProviders = await db.select().from(providers);
  const allCategories = await db.select().from(categories);

  const providerBySlug = new Map(
    allProviders.map((provider) => [provider.slug, provider]),
  );
  const categoryBySlug = new Map(
    allCategories.map((category) => [category.slug, category]),
  );

  for (const seedCourse of SEED_COURSES) {
    const existing = await findCourseBySlug(db, seedCourse.slug);
    if (existing) {
      continue;
    }

    const provider = providerBySlug.get(seedCourse.providerSlug);
    if (!provider) {
      console.warn(
        `Skipping course ${seedCourse.slug}: provider ${seedCourse.providerSlug} missing`,
      );
      continue;
    }

    const now = new Date();
    const course = await createCourse(db, {
      slug: seedCourse.slug,
      title: seedCourse.title,
      shortDescription: seedCourse.shortDescription,
      description: `${seedCourse.description}\n\nWhy learn this: ${seedCourse.whyLearn}`,
      providerId: provider.id,
      canonicalUrl: seedCourse.canonicalUrl,
      outboundUrl: seedCourse.canonicalUrl,
      instructor: seedCourse.instructor,
      language: seedCourse.language,
      level: seedCourse.level,
      durationMinutes: seedCourse.durationMinutes,
      priceType: seedCourse.priceType,
      certificateType: seedCourse.certificateType,
      freeDurability: deriveFreeDurability(
        seedCourse.providerSlug,
        seedCourse.priceType,
      ),
      qualityScore: seedCourse.qualityScore,
      aiScore: seedCourse.aiScore,
      editorScore: seedCourse.editorScore,
      status: "PUBLISHED",
      publishedAt: now,
      lastVerifiedAt: now,
    });

    const categoryIds = seedCourse.categorySlugs
      .map((slug) => categoryBySlug.get(slug)?.id)
      .filter((id): id is string => Boolean(id));

    await setCourseCategories(db, course.id, categoryIds);
  }
}

export async function runSeed(db: Db) {
  await seedProviders(db);
  await seedProviderPolicies(db);
  await seedCategories(db);
  await seedDiscoveryQueries(db);
  await seedAffiliateMonetization(db);
  await seedCouponSources(db);
  await seedAdminUsers(db);
  await seedCourses(db);
}

async function seed() {
  const { db, close } = createScriptDb();

  if (process.env.USE_NEON_HTTP === "1" || process.env.USE_NEON_HTTP === "true") {
    console.log("Using Neon HTTP driver (port 443) — works behind firewalls/proxy");
  } else {
    console.log("Using PostgreSQL TCP driver (port 5432)");
  }

  await runSeed(db);
  await close();
}

seed()
  .then(() => {
    console.log("Seed completed successfully");
  })
  .catch((error: unknown) => {
    console.error("Seed failed", error);
    if (
      !(process.env.USE_NEON_HTTP === "1" || process.env.USE_NEON_HTTP === "true") &&
      error instanceof Error &&
      String(error.cause ?? error.message).includes("ETIMEDOUT")
    ) {
      console.error("");
      console.error("Tip: port 5432 may be blocked. Retry with:");
      console.error("  USE_NEON_HTTP=1 npm run db:seed");
    }
    process.exit(1);
  });
