import { slugify } from "@/lib/slug";

const SEED_PROVIDERS = [
  { name: "Coursera", slug: "coursera", domain: "coursera.org" },
  { name: "Udemy", slug: "udemy", domain: "udemy.com" },
  { name: "edX", slug: "edx", domain: "edx.org" },
  {
    name: "Microsoft Learn",
    slug: "microsoft-learn",
    domain: "learn.microsoft.com",
  },
  {
    name: "freeCodeCamp",
    slug: "freecodecamp",
    domain: "freecodecamp.org",
  },
  { name: "AWS", slug: "aws", domain: "aws.amazon.com" },
  { name: "Google", slug: "google", domain: "developers.google.com" },
  {
    name: "LinkedIn Learning",
    slug: "linkedin-learning",
    domain: "linkedin.com",
  },
] as const;

const SEED_CATEGORIES = [
  { name: "Artificial Intelligence", slug: "ai" },
  { name: "Programming", slug: "programming" },
  { name: "Data Science", slug: "data-science" },
  { name: "Cybersecurity", slug: "cybersecurity" },
  { name: "Cloud", slug: "cloud" },
  { name: "DevOps", slug: "devops" },
  { name: "Project Management", slug: "project-management" },
  { name: "Product Management", slug: "product-management" },
  { name: "Business", slug: "business" },
  { name: "Marketing", slug: "marketing" },
  { name: "Design", slug: "design" },
  { name: "Soft Skills", slug: "soft-skills" },
] as const;

const SEED_DISCOVERY_QUERIES = [
  {
    provider: "coursera",
    category: "ai",
    query: 'site:coursera.org/learn "free" artificial intelligence course',
  },
  {
    provider: "udemy",
    category: "programming",
    query: 'site:udemy.com/course "free" python course',
  },
  {
    provider: "edx",
    category: "cybersecurity",
    query: "site:edx.org/learn cybersecurity free course",
  },
  {
    provider: "microsoft-learn",
    category: "cloud",
    query: "site:learn.microsoft.com/training AI learning path",
  },
  {
    provider: "microsoft-learn",
    category: "ai",
    query: 'site:learn.microsoft.com/training/paths "artificial intelligence"',
  },
  {
    provider: "freecodecamp",
    category: "data-science",
    query: "site:freecodecamp.org/learn data analysis",
  },
] as const;

export { SEED_CATEGORIES, SEED_DISCOVERY_QUERIES, SEED_PROVIDERS };
export { SEED_COURSES } from "@/db/seed/courses";

export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function deriveAdminName(email: string): string {
  const localPart = email.split("@")[0] ?? "admin";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function deriveCategoryDescription(name: string): string {
  return `Free ${name.toLowerCase()} courses curated by FreeLearn Radar.`;
}

export type SeedEnv = {
  NODE_ENV?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  SEED_SAMPLE_COURSES?: string;
};

export type SampleCourseSeedDecision = {
  allowed: boolean;
  reason: string;
};

function isProductionSeedTarget(env: SeedEnv): boolean {
  return (
    env.NODE_ENV === "production" ||
    env.VERCEL === "1" ||
    env.VERCEL_ENV === "production"
  );
}

/**
 * Project plan Rule 9: never seed fake course data into production.
 * Sample courses require an explicit local opt-in and are refused on production runtimes.
 */
export function decideSampleCourseSeeding(env: SeedEnv): SampleCourseSeedDecision {
  if (isProductionSeedTarget(env)) {
    return {
      allowed: false,
      reason:
        "Production runtime detected — sample courses are never seeded (project plan Rule 9)",
    };
  }

  if (env.SEED_SAMPLE_COURSES !== "true") {
    return {
      allowed: false,
      reason: "SEED_SAMPLE_COURSES is not 'true' — skipping sample course seed",
    };
  }

  return { allowed: true, reason: "Explicit local opt-in via SEED_SAMPLE_COURSES=true" };
}

export { slugify };
