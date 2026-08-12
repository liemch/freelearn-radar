import { eq } from "drizzle-orm";

import { closeDb, getDb } from "@/db";
import { createCategory } from "@/db/repositories/category-repository";
import { createDiscoveryQuery } from "@/db/repositories/discovery-query-repository";
import { createProvider } from "@/db/repositories/provider-repository";
import { createUser, findUserByEmail } from "@/db/repositories/user-repository";
import { categories, discoveryQueries, providers } from "@/db/schema";
import {
  deriveAdminName,
  deriveCategoryDescription,
  parseAdminEmails,
  SEED_CATEGORIES,
  SEED_DISCOVERY_QUERIES,
  SEED_PROVIDERS,
} from "@/db/seed/data";
import { hashPassword } from "@/lib/auth/password";

async function seedProviders(db: ReturnType<typeof getDb>) {
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

async function seedCategories(db: ReturnType<typeof getDb>) {
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

async function seedDiscoveryQueries(db: ReturnType<typeof getDb>) {
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
}

async function seedAdminUsers(db: ReturnType<typeof getDb>) {
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

async function seed() {
  const db = getDb();

  await seedProviders(db);
  await seedCategories(db);
  await seedDiscoveryQueries(db);
  await seedAdminUsers(db);

  await closeDb();
}

seed()
  .then(() => {
    console.log("Seed completed successfully");
  })
  .catch((error: unknown) => {
    console.error("Seed failed", error);
    process.exit(1);
  });
