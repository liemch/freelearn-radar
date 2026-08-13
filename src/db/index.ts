import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Options } from "postgres";

import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env";

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export type Db = ReturnType<typeof drizzle<typeof schema>>;

function postgresOptions(databaseUrl: string): Options<Record<string, never>> {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get("sslmode");
  const needsSsl =
    sslMode === "require" ||
    sslMode === "verify-full" ||
    databaseUrl.includes("neon.tech") ||
    databaseUrl.includes("supabase.co");

  return {
    max: 1,
    connect_timeout: 30,
    ...(needsSsl ? { ssl: "require" as const } : {}),
  };
}

export function getDb(): Db {
  if (dbInstance) {
    return dbInstance;
  }

  const env = getServerEnv();
  client = postgres(env.DATABASE_URL, postgresOptions(env.DATABASE_URL));
  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

export async function closeDb() {
  if (client) {
    await client.end();
    client = null;
    dbInstance = null;
  }
}

export { schema };
