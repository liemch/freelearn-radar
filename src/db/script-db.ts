import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { neon } from "@neondatabase/serverless";
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

/** Explicit opt-in for Neon HTTP (port 443) when local port 5432 is blocked. */
export function shouldUseNeonHttpExplicit(): boolean {
  return (
    process.env.USE_NEON_HTTP === "1" || process.env.USE_NEON_HTTP === "true"
  );
}

export type ScriptDbHandle = {
  db: Db;
  close: () => Promise<void>;
};

/** Always uses postgres-js TCP — default for Vercel build scripts. */
export function createTcpScriptDb(databaseUrl = resolveScriptDatabaseUrl()): ScriptDbHandle {
  const client = postgres(databaseUrl, postgresOptions(databaseUrl));
  const db = drizzlePostgres(client, { schema });

  return {
    db,
    close: async () => {
      await client.end();
    },
  };
}

/** TCP connection without schema — used only by drizzle migrator. */
export function createTcpMigrateClient(databaseUrl = resolveScriptDatabaseUrl()) {
  const client = postgres(databaseUrl, postgresOptions(databaseUrl));
  const db = drizzlePostgres(client);

  return {
    db,
    close: async () => {
      await client.end();
    },
  };
}

/** Seed/migrate scripts: TCP by default; HTTP only when USE_NEON_HTTP=1 (local firewall workaround). */
export function createScriptDb(): ScriptDbHandle {
  const databaseUrl = resolveScriptDatabaseUrl();

  if (shouldUseNeonHttpExplicit()) {
    const client = neon(databaseUrl);
    const db = drizzleHttp({ client, schema }) as unknown as Db;
    return {
      db,
      close: async () => {},
    };
  }

  return createTcpScriptDb(databaseUrl);
}
