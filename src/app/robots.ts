import type { MetadataRoute } from "next";

import { getServerEnv } from "@/lib/env";

/**
 * Indexing policy (M17):
 * - Allow public discovery landings and course pages
 * - Disallow admin/API
 * - Filtered search/category crawl explosions controlled via page-level noindex
 *   (robots.txt cannot express query strings portably)
 */
export default function robots(): MetadataRoute.Robots {
  let appUrl = "http://localhost:3000";
  try {
    appUrl = getServerEnv().APP_URL;
  } catch {
    appUrl = process.env.APP_URL || "http://localhost:3000";
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
