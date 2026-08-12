import { getDb, type Db } from "@/db";
import { logger } from "@/lib/logger";

export async function withDb<T>(
  operation: string,
  fn: (db: Db) => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn(getDb());
  } catch (error) {
    logger.warn(operation, {
      status: "fallback",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return fallback;
  }
}
