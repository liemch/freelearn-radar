import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regenerates scripts/neon-bootstrap.sql from the migration chain.
 *
 * The file used to be hand-maintained, and drifted: migrations 0003 and 0004
 * were never copied in, so a database created from it was missing the course
 * image and candidate source-fetch columns while claiming to be up to date.
 * Generating it removes the opportunity for that to happen again.
 *
 *   npm run db:bootstrap:generate
 */

type JournalEntry = { idx: number; when: number; tag: string };

const ROOT = join(import.meta.dirname, "..");
const DRIZZLE_DIR = join(ROOT, "drizzle");
const OUTPUT = join(ROOT, "scripts", "neon-bootstrap.sql");
const SEED = join(ROOT, "scripts", "bootstrap-seed.sql");

const HEADER = `-- FreeLearn Radar — manual bootstrap for Neon SQL Editor (FALLBACK ONLY)
--
-- GENERATED FILE — do not edit by hand.
-- Regenerate with: npm run db:bootstrap:generate
-- Source of truth: drizzle/*.sql (ordered by drizzle/meta/_journal.json)
--
-- Prefer the automated deploy instead:
--   vercel-build runs \`db:migrate:run\` + \`db:seed\` on each Vercel deploy (idempotent).
--
-- Use this file only when:
--   - deploy bootstrap failed, or
--   - you cannot deploy and need a one-shot SQL paste in Neon SQL Editor.
--
-- Neon SQL Editor: paste the ENTIRE file → Run once (not line by line).
-- Afterwards run \`npm run db:seed\` to load providers, categories, and queries.
`;

function main() {
  const journal = JSON.parse(
    readFileSync(join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };

  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);
  const parts: string[] = [HEADER];
  const tracking: string[] = [];

  for (const entry of entries) {
    const path = join(DRIZZLE_DIR, `${entry.tag}.sql`);
    const sql = readFileSync(path, "utf8");

    // Drizzle records the sha256 of the file contents; matching it here means a
    // bootstrapped database is not re-migrated on the next deploy.
    const hash = createHash("sha256").update(sql).digest("hex");

    parts.push(`-- ========== MIGRATION ${entry.tag} ==========\n${sql.trim()}\n`);
    tracking.push(
      [
        `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")`,
        `SELECT '${hash}', ${entry.when}`,
        `WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '${hash}');`,
      ].join("\n"),
    );
  }

  parts.push(
    [
      "-- ========== DRIZZLE MIGRATION TRACKING ==========",
      'CREATE SCHEMA IF NOT EXISTS "drizzle";',
      'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (',
      "  id SERIAL PRIMARY KEY,",
      "  hash text NOT NULL,",
      "  created_at bigint",
      ");",
      ...tracking,
      "",
    ].join("\n"),
  );

  parts.push(readFileSync(SEED, "utf8").trim() + "\n");

  writeFileSync(OUTPUT, parts.join("\n"), "utf8");

  console.log(
    `Wrote ${OUTPUT} from ${entries.length} migrations: ${entries
      .map((entry) => entry.tag)
      .join(", ")}`,
  );
}

main();
