/**
 * Serves the verification Postgres over TCP so the real Next.js application can
 * connect to it with its normal `postgres-js` driver and `DATABASE_URL`.
 *
 * This is what makes end-to-end HTTP verification possible without Docker: the
 * app is not modified or stubbed in any way — it simply talks to a Postgres that
 * happens to be PGlite behind a wire-protocol socket.
 *
 * Verification-only. Never used by application code.
 */

import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { vector } from "@electric-sql/pglite-pgvector";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/db/schema";
import type { Db } from "@/db";

import { applyMigrations } from "./pg-harness";
import { seedHttpFixtures } from "./http-fixtures";

const PORT = Number(process.env.VERIFY_PG_PORT ?? 55432);

async function main() {
  const pg = await PGlite.create({ extensions: { vector, pg_trgm, unaccent } });
  await pg.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  await pg.exec("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await pg.exec("CREATE EXTENSION IF NOT EXISTS unaccent;");

  const applied = await applyMigrations(pg, process.cwd());
  console.log(`[pg-server] applied ${applied.length} migrations`);

  const db = drizzle(pg, { schema }) as unknown as Db;
  const summary = await seedHttpFixtures(db);
  console.log(`[pg-server] seeded: ${JSON.stringify(summary)}`);

  // PGlite is single-connection; the server multiplexes. Next.js keeps several
  // pooled connections alive across route modules, so the default of 1 resets
  // every connection after the first.
  const server = new PGLiteSocketServer({
    db: pg,
    port: PORT,
    host: "127.0.0.1",
    maxConnections: 20,
    debug: process.env.VERIFY_PG_DEBUG === "1",
  });
  await server.start();
  console.log(`[pg-server] READY on 127.0.0.1:${PORT}`);

  const shutdown = async () => {
    await server.stop();
    await pg.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[pg-server] failed:", error);
  process.exit(1);
});
