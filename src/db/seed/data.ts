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

/**
 * Path-scoped discovery queries. Keep `site:host/path` tight so Tavily returns
 * course pages instead of blogs/forums (M19 URL-shape filter still applies).
 * New rows are inserted on seed; existing query text is left untouched.
 */
const SEED_DISCOVERY_QUERIES = [
  // Coursera
  {
    provider: "coursera",
    category: "ai",
    query: 'site:coursera.org/learn "free" "artificial intelligence" course',
  },
  {
    provider: "coursera",
    category: "ai",
    query: 'site:coursera.org/learn "machine learning" free course',
  },
  {
    provider: "coursera",
    category: "programming",
    query: 'site:coursera.org/learn "free" python course',
  },
  {
    provider: "coursera",
    category: "data-science",
    query: 'site:coursera.org/learn "free" "data science" course',
  },
  {
    provider: "coursera",
    category: "cloud",
    query: 'site:coursera.org/learn "free" cloud OR aws OR azure course',
  },
  {
    provider: "coursera",
    category: "business",
    query: 'site:coursera.org/learn "free" business OR "project management" course',
  },
  {
    provider: "coursera",
    category: "cybersecurity",
    query: 'site:coursera.org/learn "free" cybersecurity OR "cyber security" course',
  },
  {
    provider: "coursera",
    category: "ai",
    query: 'site:coursera.org/learn "audit for free" OR "enroll for free"',
  },

  // Udemy (often temporary free / coupon)
  {
    provider: "udemy",
    category: "programming",
    query: 'site:udemy.com/course "free" python course',
  },
  {
    provider: "udemy",
    category: "programming",
    query: 'site:udemy.com/course "free" javascript OR "web development" course',
  },
  {
    provider: "udemy",
    category: "data-science",
    query: 'site:udemy.com/course "free" "data science" OR "machine learning" course',
  },
  {
    provider: "udemy",
    category: "design",
    query: 'site:udemy.com/course "free" design OR figma OR uiux course',
  },
  {
    provider: "udemy",
    category: "marketing",
    query: 'site:udemy.com/course "free" marketing OR seo OR "digital marketing" course',
  },
  {
    provider: "udemy",
    category: "devops",
    query: 'site:udemy.com/course "free" devops OR docker OR kubernetes course',
  },

  // edX
  {
    provider: "edx",
    category: "cybersecurity",
    query: "site:edx.org/learn cybersecurity free course",
  },
  {
    provider: "edx",
    category: "ai",
    query: 'site:edx.org/learn "artificial intelligence" OR "machine learning" free',
  },
  {
    provider: "edx",
    category: "data-science",
    query: 'site:edx.org/learn "data science" free course',
  },
  {
    provider: "edx",
    category: "programming",
    query: "site:edx.org/learn python OR programming free course",
  },
  {
    provider: "edx",
    category: "business",
    query: "site:edx.org/learn business OR leadership free course",
  },

  // Microsoft Learn (mostly free)
  {
    provider: "microsoft-learn",
    category: "cloud",
    query: "site:learn.microsoft.com/training/paths azure fundamentals",
  },
  {
    provider: "microsoft-learn",
    category: "ai",
    query: 'site:learn.microsoft.com/training/paths "artificial intelligence"',
  },
  {
    provider: "microsoft-learn",
    category: "ai",
    query: "site:learn.microsoft.com/training/paths copilot OR openai",
  },
  {
    provider: "microsoft-learn",
    category: "devops",
    query: "site:learn.microsoft.com/training/paths devops OR github",
  },
  {
    provider: "microsoft-learn",
    category: "cybersecurity",
    query: "site:learn.microsoft.com/training/paths security OR cybersecurity",
  },
  {
    provider: "microsoft-learn",
    category: "programming",
    query: "site:learn.microsoft.com/training/paths python OR csharp OR javascript",
  },

  // freeCodeCamp
  {
    provider: "freecodecamp",
    category: "programming",
    query: "site:freecodecamp.org/learn responsive web design OR javascript",
  },
  {
    provider: "freecodecamp",
    category: "data-science",
    query:
      'site:freecodecamp.org/learn data analysis OR "machine learning" OR python',
  },
  {
    provider: "freecodecamp",
    category: "cybersecurity",
    query: "site:freecodecamp.org/learn information security OR cybersecurity",
  },

  // AWS Skill Builder / training
  {
    provider: "aws",
    category: "cloud",
    query: "site:skillbuilder.aws free digital course OR learning plan",
  },
  {
    provider: "aws",
    category: "cloud",
    query: 'site:aws.amazon.com/training "free digital training"',
  },
  {
    provider: "aws",
    category: "ai",
    query: "site:skillbuilder.aws machine learning OR generative ai free",
  },

  // Google Developers / Skillshop-style
  {
    provider: "google",
    category: "ai",
    query: "site:developers.google.com/learn machine learning OR generative ai",
  },
  {
    provider: "google",
    category: "cloud",
    query: "site:developers.google.com/learn google cloud OR gcp",
  },
  {
    provider: "google",
    category: "programming",
    query: "site:developers.google.com/learn android OR flutter OR web",
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
