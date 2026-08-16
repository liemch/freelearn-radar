import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Options } from "postgres";

import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env";

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export type Db = ReturnType<typeof drizzle<typeof schema>>;

function readPoolMax(): number {
  // A single connection (the previous default) forced every withDb call on a
  // page — and every concurrent request in a serverless instance — to queue on
  // one socket, which is the main reason navigation felt slow: the homepage
  // fires 6–7 parallel queries that were being fully serialized. Allow a small
  // pool so those run concurrently. Tunable via DATABASE_POOL_MAX; use Neon's
  // "-pooler" (PgBouncer) connection string in production so many serverless
  // instances don't exhaust the direct connection limit.
  const raw = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.min(raw, 50);
  }
  return 10;
}

function postgresOptions(databaseUrl: string): Options<Record<string, never>> {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get("sslmode");
  const needsSsl =
    sslMode === "require" ||
    sslMode === "verify-full" ||
    databaseUrl.includes("neon.tech") ||
    databaseUrl.includes("supabase.co");

  // Transaction-mode poolers (PgBouncer / Neon "-pooler") reuse backends across
  // clients, so cached prepared statements leak between sessions and error out.
  // Disable prepared statements only in that case; direct connections keep them.
  const usesTransactionPooler =
    databaseUrl.includes("-pooler.") ||
    url.searchParams.get("pgbouncer") === "true";

  return {
    max: readPoolMax(),
    idle_timeout: 20,
    connect_timeout: 30,
    ...(usesTransactionPooler ? { prepare: false } : {}),
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
