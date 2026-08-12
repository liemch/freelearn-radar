import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  await migrate(db, { migrationsFolder });
  await client.end();
}

runMigrations()
  .then(() => {
    console.log("Migrations completed successfully");
  })
  .catch((error: unknown) => {
    console.error("Migration failed", error);
    process.exit(1);
  });
