import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env";

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function getDb(): Db {
  if (dbInstance) {
    return dbInstance;
  }

  const env = getServerEnv();
  client = postgres(env.DATABASE_URL, { max: 1 });
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
