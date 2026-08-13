import type { MetadataRoute } from "next";

import { listCategories } from "@/db/repositories/category-repository";
import { listPublishedCourses } from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { DURATION_BUCKETS } from "@/domain/course/catalog-query";
import { listTopicSlugs } from "@/domain/discovery/topic-landings";
import { locales } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/path";
import { getServerEnv } from "@/lib/env";
import { withDb } from "@/lib/db-safe";

function localizedUrls(appUrl: string, path: string): string[] {
  return locales.map((locale) => `${appUrl}${localePath(locale, path)}`);
}

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

  const bestMonths: MetadataRoute.Sitemap = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date(Date.UTC(year, now.getUTCMonth() - offset, 1));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    for (const url of localizedUrls(appUrl, `/best/${y}/${m}`)) {
      bestMonths.push({
        url,
        lastModified: now,
        changeFrequency: "weekly",
        priority: offset === 0 ? 0.9 : 0.6,
      });
    }
  }

  const staticPaths = [
    "/",
    "/search",
    "/free-certificate-courses",
    ...Object.values(DURATION_BUCKETS).map((bucket) => `/collections/${bucket.slug}`),
    ...listTopicSlugs().map((topic) => `/free-courses/${topic}`),
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.flatMap((path) =>
    localizedUrls(appUrl, path).map((url) => ({
      url,
      lastModified: now,
      changeFrequency: path === "/" ? ("daily" as const) : ("weekly" as const),
      priority: path === "/" ? 1 : 0.7,
    })),
  );

  return [
    ...staticEntries,
    ...bestMonths,
    ...categories.flatMap((category) =>
      localizedUrls(appUrl, `/category/${category.slug}`).map((url) => ({
        url,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ),
    ...providers.flatMap((provider) =>
      localizedUrls(appUrl, `/provider/${provider.slug}`).map((url) => ({
        url,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.65,
      })),
    ),
    ...courses.flatMap((course) =>
      localizedUrls(appUrl, `/course/${course.slug}`).map((url) => ({
        url,
        lastModified: course.updatedAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ),
  ];
}
