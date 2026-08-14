import { z } from "zod";

const optionalString = z.string().optional().default("");

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production"
  );
}

const baseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: optionalString,
  ADMIN_EMAILS: optionalString,
  ADMIN_BOOTSTRAP_PASSWORD: optionalString,
  CRON_SECRET: optionalString,
  NVIDIA_API_KEY: optionalString,
  NVIDIA_BASE_URL: z
    .string()
    .url()
    .default("https://integrate.api.nvidia.com/v1"),
  NVIDIA_MODEL: optionalString,
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  TAVILY_API_KEY: optionalString,
  DISCOVERY_QUERY_LIMIT: z.coerce.number().int().positive().max(200).default(50),
  DISCOVERY_RESULT_LIMIT: z.coerce.number().int().positive().default(10),
  AI_ANALYSIS_LIMIT: z.coerce.number().int().positive().default(60),
  MAX_VERIFICATIONS_PER_RUN: z.coerce.number().int().positive().default(25),
  MAX_SOURCE_FETCHES_PER_RUN: z.coerce.number().int().positive().default(60),
  SOURCE_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  SOURCE_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(512 * 1024),
  SOURCE_MAX_REDIRECTS: z.coerce.number().int().positive().default(5),
  // Upper bounds are deliberate: these govern outbound traffic to third-party
  // course pages, and a mistyped value should fail validation rather than
  // hammer a provider.
  MONITOR_DAILY_FETCH_BUDGET: z.coerce
    .number()
    .int()
    .positive()
    .max(5_000)
    .default(50),
  MONITOR_CONCURRENCY: z.coerce.number().int().positive().max(16).default(2),
  MONITOR_PER_DOMAIN_RPM: z.coerce
    .number()
    .int()
    .positive()
    .max(600)
    .default(20),
  MONITOR_USER_AGENT: z
    .string()
    .default(
      "FreeLearnRadarBot/1.0 (+https://freelearnradar.com/about; course availability monitor)",
    ),
  /**
   * Market whose pricing this deployment observes. Price observations from
   * different regions are not comparable (§69.3), so every observation is
   * stamped with this value and events only confirm within one region.
   */
  MONITOR_OBSERVED_REGION: z.string().min(1).default("US"),
  MONITOR_WORKER_VERSION: z.string().default("m19.5"),
  /** Set to "false" to stop all outbound monitoring without a redeploy. */
  MONITOR_ENABLED: z.string().default("true"),
  FEATURE_TRACKER_UI: optionalString,
  FEATURE_PRICE_ALERTS: optionalString,
  // FEATURE_PUBLIC_FEED intentionally absent: the RSS feed and /api/public/events
  // it was meant to gate do not exist, and a flag that gates nothing reads as a
  // shipped feature that has been switched off.
  FEATURE_AUTO_STATUS: optionalString,
  FEATURE_TOPIC_PAGES: optionalString,
  // M20 search / embedding (plan §104) — flags default OFF
  EMBEDDING_PROVIDER: z.string().default("nvidia"),
  EMBEDDING_MODEL: z.string().default("nvidia/nv-embedqa-e5-v5"),
  EMBEDDING_VERSION: z.string().default("v1"),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(1024),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().max(100).default(20),
  EMBEDDING_CONCURRENCY: z.coerce.number().int().positive().max(8).default(2),
  EMBEDDING_DAILY_BUDGET_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(500_000),
  EMBEDDING_QUERY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(400),
  EMBED_AI_DERIVED_FIELDS: z.string().default("false"),
  VECTOR_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(250),
  VECTOR_TOP_K: z.coerce.number().int().positive().max(200).default(50),
  QUERY_EMBEDDING_CACHE_TTL_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  NL_INTENT_DAILY_CALLS: z.coerce.number().int().positive().default(2000),
  NL_INTENT_PER_IP_HOURLY: z.coerce.number().int().positive().default(20),
  NL_INTENT_MAX_QUERY_CHARS: z.coerce.number().int().positive().default(512),
  FEATURE_SEMANTIC_SEARCH: optionalString,
  FEATURE_HYBRID_SEARCH: optionalString,
  FEATURE_NL_COURSE_FINDER: optionalString,
  FEATURE_SIMILAR_COURSES: optionalString,
  FEATURE_COURSE_COMPARE: optionalString,
  FEATURE_LEARNING_PATHS: optionalString,
  FEATURE_CROSS_LANGUAGE: optionalString,
  FEATURE_MONETIZATION: optionalString,
  FEATURE_COURSE_AFFILIATE: optionalString,
  FEATURE_COMMERCE_AFFILIATE: optionalString,
  // M21 coupon / discovery / media (flags default OFF)
  FEATURE_COUPON_DISCOVERY: optionalString,
  FEATURE_COUPON_PUBLIC_SURFACE: optionalString,
  FEATURE_MEDIA_RESOLVER: optionalString,
  FEATURE_INTERESTS: optionalString,
  FEATURE_DISCOVERY_UX: optionalString,
  COUPON_DISCOVERY_MAX_PAGES_PER_RUN: z.coerce
    .number()
    .int()
    .positive()
    .max(50)
    .default(5),
  COUPON_DISCOVERY_MAX_CANDIDATES: z.coerce
    .number()
    .int()
    .positive()
    .max(500)
    .default(80),
  COUPON_DISCOVERY_MAX_CANDIDATES_PER_RUN: z.coerce
    .number()
    .int()
    .positive()
    .max(500)
    .default(40),
  COUPON_VERIFY_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .max(16)
    .default(2),
  COUPON_VERIFY_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .max(200)
    .default(25),
  IMAGE_RESOLVE_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .max(16)
    .default(4),
  EMAIL_DRY_RUN: z.string().default("true"),
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,
  EMAIL_REPLY_TO: optionalString,
  EMAIL_DAILY_BUDGET: z.coerce
    .number()
    .int()
    .positive()
    .max(100_000)
    .default(500),
  EMAIL_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10_000),
});

export type ServerEnv = z.infer<typeof baseEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = baseEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  const env = parsed.data;

  if (isProductionRuntime()) {
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
      throw new Error(
        "AUTH_SECRET must be at least 32 characters in production",
      );
    }
    if (!env.CRON_SECRET || env.CRON_SECRET.length < 16) {
      throw new Error(
        "CRON_SECRET must be at least 16 characters in production",
      );
    }
  }

  cachedEnv = env;
  return cachedEnv;
}

export function resetServerEnvCache(): void {
  cachedEnv = null;
}
