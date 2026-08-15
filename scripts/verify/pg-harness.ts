/**
 * Runtime verification harness — a real Postgres, in process.
 *
 * The previous validation run could only check the database statically because
 * no Postgres was reachable locally. This runs the actual `drizzle/*.sql`
 * migrations against PGlite (WASM Postgres) with the same extensions production
 * uses — `unaccent`, `pg_trgm`, `vector` — so repository and domain code can be
 * exercised against real SQL, real constraints and real side effects.
 *
 * Verification-only. Nothing here is imported by application code.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/db/schema";
import type { Db } from "@/db";

export type Harness = {
  pg: PGlite;
  db: Db;
  /** Raw SQL escape hatch for asserting side effects independently of the ORM. */
  sql: (query: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  close: () => Promise<void>;
};

type JournalEntry = { idx: number; tag: string };

function readJournal(repoRoot: string): JournalEntry[] {
  const journalPath = path.join(repoRoot, "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: JournalEntry[];
  };
  return [...journal.entries].sort((a, b) => a.idx - b.idx);
}

/**
 * Applies migrations in journal order using the real SQL files, mirroring what
 * `src/db/migrate.ts` does over TCP. Drizzle's own migrator is bypassed so a
 * failure points at the offending file instead of a hash mismatch.
 */
export async function applyMigrations(
  pg: PGlite,
  repoRoot: string,
): Promise<string[]> {
  const applied: string[] = [];
  for (const entry of readJournal(repoRoot)) {
    const file = path.join(repoRoot, "drizzle", `${entry.tag}.sql`);
    const sqlText = readFileSync(file, "utf8");
    try {
      await pg.exec(sqlText);
      applied.push(entry.tag);
    } catch (error) {
      throw new Error(
        `Migration ${entry.tag} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  return applied;
}

export async function createHarness(options?: {
  repoRoot?: string;
  migrate?: boolean;
}): Promise<Harness> {
  const repoRoot = options?.repoRoot ?? process.cwd();

  const pg = await PGlite.create({
    extensions: { vector, pg_trgm, unaccent },
  });

  // Production creates these inside migrations 0008/0010; creating them up front
  // as well keeps a migration failure from being masked by a missing extension.
  await pg.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  await pg.exec("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  await pg.exec("CREATE EXTENSION IF NOT EXISTS unaccent;");

  if (options?.migrate !== false) {
    await applyMigrations(pg, repoRoot);
  }

  const db = drizzle(pg, { schema }) as unknown as Db;

  return {
    pg,
    db,
    sql: async (query: string, params: unknown[] = []) => {
      const result = await pg.query(query, params);
      return result.rows as Record<string, unknown>[];
    },
    close: async () => {
      await pg.close();
    },
  };
}

/** Formats a check line so scan output is greppable. */
export function check(
  label: string,
  passed: boolean,
  detail?: string,
): boolean {
  const mark = passed ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
  return passed;
}

export class CheckRun {
  private passed = 0;
  private failed = 0;
  private readonly failures: string[] = [];

  section(title: string): void {
    console.log(`\n=== ${title} ===`);
  }

  expect(label: string, condition: boolean, detail?: string): void {
    if (check(label, condition, detail)) {
      this.passed += 1;
    } else {
      this.failed += 1;
      this.failures.push(label);
    }
  }

  expectEqual(label: string, actual: unknown, expected: unknown): void {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    this.expect(
      label,
      ok,
      ok ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }

  summary(): number {
    console.log(
      `\n--- ${this.passed} passed, ${this.failed} failed ---`,
    );
    if (this.failures.length > 0) {
      console.log("FAILED CHECKS:");
      for (const failure of this.failures) {
        console.log(`  - ${failure}`);
      }
    }
    return this.failed;
  }
}
