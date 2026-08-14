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
  DISCOVERY_QUERY_LIMIT: z.coerce.number().int().positive().default(15),
  DISCOVERY_RESULT_LIMIT: z.coerce.number().int().positive().default(5),
  AI_ANALYSIS_LIMIT: z.coerce.number().int().positive().default(30),
  MAX_VERIFICATIONS_PER_RUN: z.coerce.number().int().positive().default(25),
  MAX_SOURCE_FETCHES_PER_RUN: z.coerce.number().int().positive().default(20),
  SOURCE_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  SOURCE_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(512 * 1024),
  SOURCE_MAX_REDIRECTS: z.coerce.number().int().positive().default(5),
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
