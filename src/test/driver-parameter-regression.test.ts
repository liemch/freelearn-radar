/**
 * Guards against a defect class that only the production driver exposes.
 *
 * Drizzle's raw `sql` template passes interpolated values straight through as
 * bind parameters. `postgres-js` — the driver production uses — throws
 * `ERR_INVALID_ARG_TYPE: The "string" argument must be of type string ... Received
 * an instance of Date` when one of those parameters is a JS `Date`. Other drivers
 * (PGlite, neon-http) accept it, so unit tests and in-process harnesses pass
 * while every real request fails.
 *
 * Because `withDb` converts a thrown query into an empty fallback, the symptom is
 * a page that confidently renders "no results" forever. Two shipped queries were
 * broken this way: the daily-free offer list and the coupon recheck queue.
 *
 * The fix is always the same — use a typed operator (`gt`, `lt`, `lte`, `gte`,
 * `eq`) so Drizzle maps the value through the column's driver serializer.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();

/** Files that issue SQL. Kept explicit so the guard cannot silently stop scanning. */
const SQL_SOURCE_DIRS = [
  "src/db/repositories",
  "src/domain",
  "src/app/api",
];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        out.push(full);
      }
    }
  };
  const abs = path.join(REPO_ROOT, dir);
  if (existsSync(abs)) walk(abs);
  return out;
}

/**
 * Matches a `sql` template that interpolates an identifier whose name suggests a
 * timestamp. Deliberately name-based: the alternative is executing every query
 * against a real postgres-js connection, which the unit suite cannot do.
 */
const DATE_IN_TEMPLATE =
  /sql`[^`]*\$\{\s*(now|cutoff|staleBefore|since|until|from|to|expiry|expiresAt|deadline|threshold|before|after|[a-zA-Z]*(?:Date|At|Time))\s*\}[^`]*`/g;

describe("postgres-js parameter safety", () => {
  const offenders: string[] = [];

  for (const dir of SQL_SOURCE_DIRS) {
    for (const file of listTsFiles(dir)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(DATE_IN_TEMPLATE)) {
        // A column reference is fine — `${courses.imageCheckedAt}` renders as an
        // identifier, not a bind parameter. Only bare local values are unsafe.
        const interpolated = match[1]!;
        if (interpolated.includes(".")) continue;
        offenders.push(
          `${path.relative(REPO_ROOT, file)}: ${match[0].slice(0, 120)}`,
        );
      }
    }
  }

  it("no raw sql template binds a JS Date value", () => {
    expect(offenders).toEqual([]);
  });

  it("the scanner actually inspected the SQL source tree", () => {
    const scanned = SQL_SOURCE_DIRS.flatMap((d) => listTsFiles(d));
    expect(scanned.length).toBeGreaterThan(30);
  });

  it("detects the pattern it is meant to catch", () => {
    // Self-test with the exact shape of the two shipped defects.
    const sample =
      'const c = sql`(${courseOffers.expiresAt} IS NULL OR ${courseOffers.expiresAt} > ${now})`;';
    const hits = [...sample.matchAll(DATE_IN_TEMPLATE)];
    expect(hits.length).toBeGreaterThan(0);
  });
});
