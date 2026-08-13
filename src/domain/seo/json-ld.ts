import type { Course } from "@/db/schema";
import type { Provider } from "@/db/schema";

/**
 * Accurate schema.org JSON-LD only — never fabricate ratings, prices, or reviews.
 */

export function buildCourseJsonLd(input: {
  course: Pick<
    Course,
    | "title"
    | "slug"
    | "shortDescription"
    | "description"
    | "language"
    | "instructor"
    | "canonicalUrl"
  >;
  providerName: string;
  appUrl: string;
  /** Optional locale-aware public URL; defaults to unprefixed for back-compat. */
  courseUrl?: string;
}): Record<string, unknown> {
  const url =
    input.courseUrl ?? `${input.appUrl}/course/${input.course.slug}`;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: input.course.title,
    url,
    description:
      input.course.shortDescription ||
      input.course.description ||
      `Free course listed on FreeLearn Radar from ${input.providerName}.`,
    provider: {
      "@type": "Organization",
      name: input.providerName,
    },
    isAccessibleForFree: true,
  };

  if (input.course.language) {
    data.inLanguage = input.course.language;
  }

  if (input.course.instructor) {
    data.instructor = {
      "@type": "Person",
      name: input.course.instructor,
    };
  }

  // Do NOT add aggregateRating, offers price, or review without real data.
  return data;
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildItemListJsonLd(input: {
  name: string;
  description: string;
  url: string;
  courses: Array<{ title: string; slug: string }>;
  appUrl: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    description: input.description,
    url: input.url,
    numberOfItems: input.courses.length,
    itemListElement: input.courses.slice(0, 30).map((course, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${input.appUrl}/course/${course.slug}`,
      name: course.title,
    })),
  };
}

export function buildProviderJsonLd(input: {
  provider: Pick<Provider, "name" | "slug" | "domain">;
  appUrl: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.provider.name,
    url: `${input.appUrl}/provider/${input.provider.slug}`,
    sameAs: `https://${input.provider.domain}`,
  };
}
