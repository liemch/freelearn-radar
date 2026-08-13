import path from "node:path";

import "@/lib/load-env";

import {
  createScriptDb,
  resolveScriptDatabaseUrl,
  shouldUseNeonHttpExplicit,
} from "@/db/script-db";

async function runMigrationsOverHttp() {
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  const { neon } = await import("@neondatabase/serverless");

  const databaseUrl = resolveScriptDatabaseUrl();
  const client = neon(databaseUrl);
  const db = drizzle({ client });
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  console.log("Using Neon HTTP driver (port 443) — works behind firewalls/proxy");
  await migrate(db, { migrationsFolder });
}

async function runMigrationsOverTcp() {
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { db, close } = createScriptDb();
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  console.log("Using PostgreSQL TCP driver (port 5432)");
  if (process.env.VERCEL === "1") {
    console.log("Vercel build uses TCP migrate (Neon HTTP cannot run multi-statement SQL files)");
  }
  await migrate(db, { migrationsFolder });
  await close();
}

async function runMigrations() {
  if (shouldUseNeonHttpExplicit()) {
    await runMigrationsOverHttp();
    return;
  }

  await runMigrationsOverTcp();
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("ETIMEDOUT") ||
    String(error.cause ?? "").includes("ETIMEDOUT")
  );
}

runMigrations()
  .then(() => {
    console.log("Migrations completed successfully");
  })
  .catch((error: unknown) => {
    console.error("Migration failed", error);
    if (!shouldUseNeonHttpExplicit() && isTimeoutError(error)) {
      console.error("");
      console.error("Tip: port 5432 may be blocked. Retry with:");
      console.error("  USE_NEON_HTTP=1 npm run db:migrate:run");
      console.error("Or paste scripts/neon-bootstrap.sql into Neon SQL Editor.");
    }
    process.exit(1);
  });
