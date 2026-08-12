import { z } from "zod";

const optionalString = z.string().optional().default("");

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: optionalString,
  ADMIN_EMAILS: optionalString,
  CRON_SECRET: optionalString,
  NVIDIA_API_KEY: optionalString,
  NVIDIA_BASE_URL: z
    .string()
    .url()
    .default("https://integrate.api.nvidia.com/v1"),
  NVIDIA_MODEL: optionalString,
  TAVILY_API_KEY: optionalString,
  DISCOVERY_QUERY_LIMIT: z.coerce.number().int().positive().default(15),
  DISCOVERY_RESULT_LIMIT: z.coerce.number().int().positive().default(5),
  AI_ANALYSIS_LIMIT: z.coerce.number().int().positive().default(30),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function resetServerEnvCache(): void {
  cachedEnv = null;
}
