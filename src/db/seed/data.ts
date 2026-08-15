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
  // §68 Group-A academies (coverage track)
  {
    name: "HubSpot Academy",
    slug: "hubspot-academy",
    domain: "academy.hubspot.com",
  },
  {
    name: "IBM SkillsBuild",
    slug: "ibm-skillsbuild",
    domain: "skillsbuild.org",
  },
  {
    name: "Salesforce Trailhead",
    slug: "salesforce-trailhead",
    domain: "trailhead.salesforce.com",
  },
  {
    name: "Kaggle Learn",
    slug: "kaggle-learn",
    domain: "kaggle.com",
  },
] as const;

const SEED_CATEGORIES = [
  { name: "Trí tuệ nhân tạo", slug: "ai" },
  { name: "Lập trình", slug: "programming" },
  { name: "Khoa học dữ liệu", slug: "data-science" },
  { name: "An ninh mạng", slug: "cybersecurity" },
  { name: "Điện toán đám mây", slug: "cloud" },
  { name: "DevOps", slug: "devops" },
  { name: "Quản lý dự án", slug: "project-management" },
  { name: "Quản lý sản phẩm", slug: "product-management" },
  { name: "Kinh doanh & Quản lý", slug: "business" },
  { name: "Marketing", slug: "marketing" },
  { name: "Thiết kế & Sáng tạo", slug: "design" },
  { name: "Kỹ năng mềm", slug: "soft-skills" },
  // M21.1 multi-domain expansion
  { name: "Tài chính", slug: "finance" },
  { name: "Phát triển bản thân", slug: "personal-development" },
  { name: "Cuộc sống & Sức khỏe", slug: "lifestyle-health" },
  { name: "Ngoại ngữ", slug: "languages" },
  { name: "Văn phòng & Công việc", slug: "office-productivity" },
  { name: "Giáo dục", slug: "education" },
  { name: "Khoa học & Kỹ thuật", slug: "science-engineering" },
  { name: "Xã hội & Nhân văn", slug: "humanities" },
  { name: "Nghề nghiệp", slug: "career" },
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
  {
    provider: "microsoft-learn",
    category: "data-science",
    query: 'site:learn.microsoft.com/training/modules "power bi" OR "data analysis"',
  },
  {
    provider: "microsoft-learn",
    category: "ai",
    query: "site:learn.microsoft.com/training/modules azure ai OR openai OR copilot",
  },
  {
    provider: "microsoft-learn",
    category: "cloud",
    query: "site:learn.microsoft.com/training/modules azure storage OR networking OR compute",
  },
  {
    provider: "microsoft-learn",
    category: "devops",
    query: "site:learn.microsoft.com/training/modules github actions OR pipelines",
  },
  {
    provider: "microsoft-learn",
    category: "cybersecurity",
    query: "site:learn.microsoft.com/training/modules identity OR defender OR zero trust",
  },
  {
    provider: "microsoft-learn",
    category: "programming",
    query: "site:learn.microsoft.com/training/modules python OR dotnet OR typescript",
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
  {
    provider: "freecodecamp",
    category: "programming",
    query: "site:freecodecamp.org/learn front end libraries OR react",
  },
  {
    provider: "freecodecamp",
    category: "programming",
    query: "site:freecodecamp.org/learn apis OR microservices OR node",
  },
  {
    provider: "freecodecamp",
    category: "programming",
    query: "site:freecodecamp.org/learn algorithms OR data structures",
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

  // Existing providers — thin categories
  {
    provider: "coursera",
    category: "product-management",
    query: 'site:coursera.org/learn "product management" free course',
  },
  {
    provider: "coursera",
    category: "soft-skills",
    query: 'site:coursera.org/learn "soft skills" OR communication OR leadership free',
  },
  {
    provider: "edx",
    category: "soft-skills",
    query: "site:edx.org/learn leadership OR communication free course",
  },

  // HubSpot Academy
  {
    provider: "hubspot-academy",
    category: "marketing",
    query: "site:academy.hubspot.com courses marketing OR inbound free",
  },
  {
    provider: "hubspot-academy",
    category: "business",
    query: "site:academy.hubspot.com courses sales OR service free",
  },
  {
    provider: "hubspot-academy",
    category: "soft-skills",
    query: "site:academy.hubspot.com courses content OR social media",
  },
  {
    provider: "hubspot-academy",
    category: "marketing",
    query: "site:academy.hubspot.com courses email marketing OR seo",
  },
  {
    provider: "hubspot-academy",
    category: "business",
    query: "site:academy.hubspot.com courses crm OR revenue operations",
  },
  {
    provider: "hubspot-academy",
    category: "product-management",
    query: "site:academy.hubspot.com courses customer success OR onboarding",
  },

  // IBM SkillsBuild
  {
    provider: "ibm-skillsbuild",
    category: "ai",
    query: "site:skillsbuild.org course artificial intelligence OR machine learning",
  },
  {
    provider: "ibm-skillsbuild",
    category: "cybersecurity",
    query: "site:skillsbuild.org course cybersecurity OR security",
  },
  {
    provider: "ibm-skillsbuild",
    category: "data-science",
    query: "site:skillsbuild.org course data science OR data analysis",
  },
  {
    provider: "ibm-skillsbuild",
    category: "cloud",
    query: "site:skillsbuild.org course cloud computing OR containers",
  },
  {
    provider: "ibm-skillsbuild",
    category: "programming",
    query: "site:skillsbuild.org course web development OR python",
  },
  {
    provider: "ibm-skillsbuild",
    category: "soft-skills",
    query: "site:skillsbuild.org course design thinking OR professional skills",
  },

  // Salesforce Trailhead
  {
    provider: "salesforce-trailhead",
    category: "business",
    query: "site:trailhead.salesforce.com trail admin OR sales cloud",
  },
  {
    provider: "salesforce-trailhead",
    category: "programming",
    query: "site:trailhead.salesforce.com trail apex OR lightning OR developer",
  },
  {
    provider: "salesforce-trailhead",
    category: "soft-skills",
    query: "site:trailhead.salesforce.com trail soft skills OR career",
  },
  {
    provider: "salesforce-trailhead",
    category: "data-science",
    query: "site:trailhead.salesforce.com trail data OR analytics OR tableau",
  },
  {
    provider: "salesforce-trailhead",
    category: "cybersecurity",
    query: "site:trailhead.salesforce.com trail security OR identity",
  },
  {
    provider: "salesforce-trailhead",
    category: "marketing",
    query: "site:trailhead.salesforce.com trail marketing cloud OR campaigns",
  },
  {
    provider: "salesforce-trailhead",
    category: "project-management",
    query: "site:trailhead.salesforce.com trail agile OR project management",
  },

  // Kaggle Learn
  {
    provider: "kaggle-learn",
    category: "data-science",
    query: "site:kaggle.com/learn python OR pandas OR data visualization",
  },
  {
    provider: "kaggle-learn",
    category: "ai",
    query: "site:kaggle.com/learn machine learning OR deep learning OR intro to ai",
  },
  {
    provider: "kaggle-learn",
    category: "programming",
    query: "site:kaggle.com/learn sql OR python intro",
  },
  {
    provider: "kaggle-learn",
    category: "data-science",
    query: "site:kaggle.com/learn feature engineering OR time series",
  },
  {
    provider: "kaggle-learn",
    category: "ai",
    query: "site:kaggle.com/learn computer vision OR natural language processing",
  },
  {
    provider: "kaggle-learn",
    category: "data-science",
    query: "site:kaggle.com/learn data cleaning OR geospatial analysis",
  },

  // Google Developers — free pathways
  {
    provider: "google",
    category: "programming",
    query: "site:developers.google.com/learn firebase OR maps OR pathway",
  },
  {
    provider: "google",
    category: "data-science",
    query: "site:developers.google.com/learn data OR bigquery OR analytics",
  },

  // M21.2 — balanced multi-domain seeds (VI + EN hints; discovery ≠ Truth)
  {
    provider: "udemy",
    category: "soft-skills",
    query: 'site:udemy.com/course "communication skills" free OR coupon',
  },
  {
    provider: "udemy",
    category: "soft-skills",
    query: 'site:udemy.com/course "kỹ năng giao tiếp" OR "public speaking" free',
  },
  {
    provider: "udemy",
    category: "personal-development",
    query: 'site:udemy.com/course "time management" free OR coupon',
  },
  {
    provider: "udemy",
    category: "personal-development",
    query: 'site:udemy.com/course "quản lý thời gian" OR productivity free',
  },
  {
    provider: "udemy",
    category: "office-productivity",
    query: 'site:udemy.com/course excel beginner free OR coupon',
  },
  {
    provider: "udemy",
    category: "office-productivity",
    query: 'site:udemy.com/course "Excel cho người mới" OR "microsoft excel" free',
  },
  {
    provider: "udemy",
    category: "languages",
    query: 'site:udemy.com/course "english speaking" free OR coupon',
  },
  {
    provider: "udemy",
    category: "languages",
    query: 'site:udemy.com/course "tiếng Anh giao tiếp" OR IELTS free',
  },
  {
    provider: "udemy",
    category: "finance",
    query: 'site:udemy.com/course "personal finance" OR investing free OR coupon',
  },
  {
    provider: "udemy",
    category: "lifestyle-health",
    query: 'site:udemy.com/course mindfulness OR yoga OR nutrition free OR coupon',
  },
  {
    provider: "udemy",
    category: "career",
    query: 'site:udemy.com/course resume OR interview OR "job search" free OR coupon',
  },
  {
    provider: "coursera",
    category: "soft-skills",
    query: 'site:coursera.org/learn "communication" OR leadership "audit for free"',
  },
  {
    provider: "coursera",
    category: "business",
    query: 'site:coursera.org/learn business OR entrepreneurship "enroll for free"',
  },
  {
    provider: "coursera",
    category: "languages",
    query: 'site:coursera.org/learn english OR language "audit for free"',
  },
  {
    provider: "coursera",
    category: "personal-development",
    query: 'site:coursera.org/learn "personal development" OR success "audit for free"',
  },
  {
    provider: "edx",
    category: "humanities",
    query: "site:edx.org/learn history OR philosophy OR psychology free",
  },
  {
    provider: "edx",
    category: "science-engineering",
    query: "site:edx.org/learn physics OR chemistry OR engineering free",
  },
  {
    provider: "edx",
    category: "education",
    query: "site:edx.org/learn teaching OR education OR pedagogy free",
  },
  {
    provider: "hubspot-academy",
    category: "marketing",
    query: "site:academy.hubspot.com marketing OR sales free certification",
  },
  {
    provider: "hubspot-academy",
    category: "office-productivity",
    query: "site:academy.hubspot.com service OR CRM free",
  },
  // M21.2 coverage floor. Interleaved selection caps any category's share of a
  // run, but a category seeded with zero or one query still cannot be
  // discovered against. These raise the floor for the thinnest domains so the
  // budget has something to spend there. `design` had no live query at all
  // after its earlier Udemy seed was retired for returning paid pages, so this
  // approaches it through coupon offers and a Vietnamese phrasing instead.
  {
    provider: "udemy",
    category: "design",
    query: 'site:udemy.com/course "graphic design" OR canva OR figma coupon OR "100% off"',
  },
  {
    provider: "udemy",
    category: "design",
    query: 'site:udemy.com/course "thiết kế" OR "đồ họa" miễn phí OR coupon',
  },
  {
    provider: "udemy",
    category: "finance",
    query: 'site:udemy.com/course "tài chính cá nhân" OR "đầu tư" miễn phí OR coupon',
  },
  {
    provider: "udemy",
    category: "career",
    query: 'site:udemy.com/course "phỏng vấn" OR "kỹ năng xin việc" miễn phí OR coupon',
  },
  {
    provider: "udemy",
    category: "lifestyle-health",
    query: 'site:udemy.com/course "sức khỏe" OR "thiền" OR "dinh dưỡng" miễn phí OR coupon',
  },
  {
    provider: "coursera",
    category: "education",
    query: 'site:coursera.org/learn teaching OR learning "audit for free"',
  },
  {
    provider: "coursera",
    category: "science-engineering",
    query: 'site:coursera.org/learn science OR engineering OR mathematics "audit for free"',
  },
  {
    provider: "coursera",
    category: "humanities",
    query: 'site:coursera.org/learn psychology OR history OR sociology "audit for free"',
  },
] as const;

/**
 * Queries kept in the schema but switched off: they returned mostly paid or
 * trial-only pages, which cost a reviewer one manual page visit each and can
 * never be published (FREE_TRIAL and PAID are barred from the free catalog).
 *
 * The seed re-asserts `enabled = false` on every run, so a query is only brought
 * back by removing it from this list.
 */
const RETIRED_DISCOVERY_QUERIES = [
  'site:linkedin.com/learning "free" leadership OR communication course',
  'site:linkedin.com/learning "product management" free course',
  'site:linkedin.com/learning "project management" free course',
  'site:udemy.com/course "free" design OR figma OR uiux course',
  'site:udemy.com/course "free" marketing OR seo OR "digital marketing" course',
  'site:udemy.com/course "free" devops OR docker OR kubernetes course',
] as const;

export {
  RETIRED_DISCOVERY_QUERIES,
  SEED_CATEGORIES,
  SEED_DISCOVERY_QUERIES,
  SEED_PROVIDERS,
};
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
