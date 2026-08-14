import "@/lib/load-env";

import { writeFileSync } from "node:fs";
import path from "node:path";

import { createScriptDb } from "@/db/script-db";
import { sampleZeroResultQueries } from "@/domain/search/baseline";
import { resetServerEnvCache } from "@/lib/env";

/**
 * Gate B sampling aid — exports top zero-result queries for human Intent
 * Diagnosis (project plan §86.3). Does not label; humans do.
 *
 *   npm run search:intent-sample -- --days=90 --limit=150
 */
async function main() {
  resetServerEnvCache();

  const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const windowDays = daysArg
    ? Number.parseInt(daysArg.split("=")[1] ?? "", 10)
    : 90;
  const limit = limitArg
    ? Number.parseInt(limitArg.split("=")[1] ?? "", 10)
    : 150;

  if (!Number.isFinite(windowDays) || windowDays < 1) {
    console.error("--days must be a positive integer");
    process.exitCode = 1;
    return;
  }
  if (!Number.isFinite(limit) || limit < 1) {
    console.error("--limit must be a positive integer");
    process.exitCode = 1;
    return;
  }

  const { db, close } = createScriptDb();

  try {
    const rows = await sampleZeroResultQueries(db, { windowDays, limit });
    const payload = {
      ok: true,
      sampledAt: new Date().toISOString(),
      windowDays,
      count: rows.length,
      rows: rows.map((row, index) => ({
        rank: index + 1,
        queryHash: row.queryHash,
        normalizedQuery: row.normalizedQuery,
        count: row.count,
        lastSeen: row.lastSeen,
        label: null as
          | null
          | "RETRIEVAL_MISS"
          | "CATALOG_GAP"
          | "CONSTRAINT_GAP"
          | "JUNK",
        notes: "",
      })),
      instruction:
        "Fill label for each row after two-person catalog review. Write the " +
        "CATALOG_GAP conclusion in docs/GATE_B_INTENT_DIAGNOSIS.md before M20.1.",
    };

    const outPath = path.join(
      process.cwd(),
      "data",
      "search-eval",
      "v1",
      "intent-sample.json",
    );
    writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(JSON.stringify({ ok: true, outPath, count: rows.length }, null, 2));
    process.exitCode = 0;
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    process.exitCode = 1;
  } finally {
    await close();
  }
}

void main();
