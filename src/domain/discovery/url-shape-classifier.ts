/**
 * Classify course URL shape at ingest — before fetch and before AI (M19 §67.5).
 * UNKNOWN shapes are allowed through; only KNOWN_NON_COURSE is rejected.
 */

export type UrlShapeClass = "COURSE" | "KNOWN_NON_COURSE" | "UNKNOWN";

export type UrlShapeClassification = {
  class: UrlShapeClass;
  providerSlug: string | null;
  matchedRule: string | null;
  reason: string;
};

type ProviderUrlShapes = {
  slug: string;
  hostSuffixes: string[];
  course: RegExp[];
  nonCourse: RegExp[];
};

const PROVIDER_SHAPES: ProviderUrlShapes[] = [
  {
    slug: "microsoft-learn",
    hostSuffixes: ["learn.microsoft.com"],
    course: [
      /\/training\/(?:modules|paths|courses)\//i,
      /\/en-us\/training\//i,
      /\/[a-z]{2}-[a-z]{2}\/training\//i,
    ],
    nonCourse: [
      /\/answers\//i,
      /\/questions\//i,
      /\/blog\//i,
      /\/shows\//i,
      /\/users\//i,
      /\/credentials\//i,
      /\/search\/?/i,
      /\/community\//i,
    ],
  },
  {
    slug: "coursera",
    hostSuffixes: ["coursera.org"],
    course: [
      /\/learn\//i,
      /\/specializations\//i,
      /\/professional-certificates\//i,
      /\/projects\//i,
    ],
    nonCourse: [
      /\/articles\//i,
      /\/collections\//i,
      /\/instructor\//i,
      /\/degrees\//i,
      /\/campus\//i,
      /\/enterprise\//i,
      /\/search\/?/i,
      /\/about\//i,
    ],
  },
  {
    slug: "udemy",
    hostSuffixes: ["udemy.com"],
    course: [/\/course\//i],
    nonCourse: [
      /\/topic\//i,
      /\/user\//i,
      /\/courses\/search/i,
      /\/blog\//i,
      /\/instructor\//i,
      /\/teaching\//i,
    ],
  },
  {
    slug: "edx",
    hostSuffixes: ["edx.org", "www.edx.org"],
    course: [/\/learn\//i, /\/course\//i, /\/certificates\//i],
    nonCourse: [/\/blog\//i, /\/resources\//i, /\/search\/?/i, /\/about\//i],
  },
  {
    slug: "freecodecamp",
    hostSuffixes: ["freecodecamp.org"],
    course: [/\/learn\//i],
    nonCourse: [/\/news\//i, /\/forum\//i, /\/newsroom\//i],
  },
  {
    slug: "aws",
    hostSuffixes: ["aws.amazon.com", "skillbuilder.aws"],
    course: [/\/training\//i, /\/learn\//i, /\/courses\//i],
    nonCourse: [/\/blogs?\//i, /\/about\//i, /\/search\/?/i],
  },
  {
    slug: "google",
    hostSuffixes: ["developers.google.com", "skillshop.exceedlms.com"],
    course: [/\/learn\//i, /\/courses?\//i, /\/training\//i],
    nonCourse: [/\/blog\//i, /\/community\//i, /\/search\/?/i],
  },
];

function matchHost(hostname: string, suffixes: string[]): boolean {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return suffixes.some((suffix) => {
    const normalized = suffix.replace(/^www\./, "").toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

function firstMatch(path: string, patterns: RegExp[]): RegExp | null {
  return patterns.find((pattern) => pattern.test(path)) ?? null;
}

export function classifyUrlShape(url: string): UrlShapeClassification {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      class: "KNOWN_NON_COURSE",
      providerSlug: null,
      matchedRule: "INVALID_URL",
      reason: "Malformed URL",
    };
  }

  const path = `${parsed.pathname}${parsed.search}`;
  const provider = PROVIDER_SHAPES.find((entry) =>
    matchHost(parsed.hostname, entry.hostSuffixes),
  );

  if (!provider) {
    return {
      class: "UNKNOWN",
      providerSlug: null,
      matchedRule: null,
      reason: "No provider URL shape registry entry",
    };
  }

  const nonCourse = firstMatch(path, provider.nonCourse);
  if (nonCourse) {
    return {
      class: "KNOWN_NON_COURSE",
      providerSlug: provider.slug,
      matchedRule: nonCourse.source,
      reason: `Known non-course path for ${provider.slug}`,
    };
  }

  const course = firstMatch(path, provider.course);
  if (course) {
    return {
      class: "COURSE",
      providerSlug: provider.slug,
      matchedRule: course.source,
      reason: `Course-shaped URL for ${provider.slug}`,
    };
  }

  return {
    class: "UNKNOWN",
    providerSlug: provider.slug,
    matchedRule: null,
    reason: `No shape match for ${provider.slug} — allow through`,
  };
}

export function isKnownNonCourseUrl(url: string): boolean {
  return classifyUrlShape(url).class === "KNOWN_NON_COURSE";
}
