import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres, { type Options } from "postgres";

import type { Db } from "@/db";
import * as schema from "@/db/schema";

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

export function resolveScriptDatabaseUrl(): string {
  const databaseUrl =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or DATABASE_URL_UNPOOLED is required for database scripts",
    );
  }

  return databaseUrl;
}

/** Use Neon HTTP driver (port 443) instead of PostgreSQL TCP (port 5432). */
export function shouldUseNeonHttp(): boolean {
  return (
    process.env.USE_NEON_HTTP === "1" ||
    process.env.USE_NEON_HTTP === "true" ||
    process.env.VERCEL === "1"
  );
}

export type ScriptDbHandle = {
  db: Db;
  close: () => Promise<void>;
};

export function createScriptDb(): ScriptDbHandle {
  const databaseUrl = resolveScriptDatabaseUrl();

  if (shouldUseNeonHttp()) {
    const client = neon(databaseUrl);
    const db = drizzleHttp({ client, schema }) as Db;
    return {
      db,
      close: async () => {},
    };
  }

  const client = postgres(databaseUrl, postgresOptions(databaseUrl));
  const db = drizzlePostgres(client, { schema });

  return {
    db,
    close: async () => {
      await client.end();
    },
  };
}
