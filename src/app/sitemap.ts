import type { MetadataRoute } from "next";

import { listCategories } from "@/db/repositories/category-repository";
import { listPublishedCourses } from "@/db/repositories/course-repository";
import { getServerEnv } from "@/lib/env";
import { withDb } from "@/lib/db-safe";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || "http://localhost:3000";
  }

  const [courses, categories] = await Promise.all([
    withDb("sitemap.courses", (db) => listPublishedCourses(db, 5000, 0), []),
    withDb("sitemap.categories", (db) => listCategories(db), []),
  ]);

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

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
      priority: 0.8,
    },
    {
      url: `${appUrl}/best/${year}/${month}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...categories.map((category) => ({
      url: `${appUrl}/category/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...courses.map((course) => ({
      url: `${appUrl}/course/${course.slug}`,
      lastModified: course.updatedAt ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
