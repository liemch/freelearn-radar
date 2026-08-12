import type { MetadataRoute } from "next";

import { listCategories } from "@/db/repositories/category-repository";
import { listPublishedCourses } from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { DURATION_BUCKETS } from "@/domain/course/catalog-query";
import { listTopicSlugs } from "@/domain/discovery/topic-landings";
import { getServerEnv } from "@/lib/env";
import { withDb } from "@/lib/db-safe";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || "http://localhost:3000";
  }

  const [courses, categories, providers] = await Promise.all([
    withDb("sitemap.courses", (db) => listPublishedCourses(db, 5000, 0), []),
    withDb("sitemap.categories", (db) => listCategories(db), []),
    withDb("sitemap.providers", (db) => listProviders(db), []),
  ]);

  const now = new Date();
  const year = now.getUTCFullYear();

  // Include current + previous 2 months for historical best pages
  const bestMonths: MetadataRoute.Sitemap = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date(Date.UTC(year, now.getUTCMonth() - offset, 1));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    bestMonths.push({
      url: `${appUrl}/best/${y}/${m}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: offset === 0 ? 0.9 : 0.6,
    });
  }

  return [
    {
      url: `${appUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${appUrl}/search`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${appUrl}/free-certificate-courses`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...Object.values(DURATION_BUCKETS).map((bucket) => ({
      url: `${appUrl}/collections/${bucket.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...listTopicSlugs().map((topic) => ({
      url: `${appUrl}/free-courses/${topic}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...bestMonths,
    ...categories.map((category) => ({
      url: `${appUrl}/category/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...providers.map((provider) => ({
      url: `${appUrl}/provider/${provider.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.65,
    })),
    ...courses.map((course) => ({
      url: `${appUrl}/course/${course.slug}`,
      lastModified: course.updatedAt ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
