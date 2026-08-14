import "@/lib/load-env";

import { createScriptDb } from "@/db/script-db";
import { buildSearchBaseline } from "@/domain/search/baseline";
import { resetServerEnvCache } from "@/lib/env";

/**
 * M20.0 baseline report (project plan §86.2).
 *
 *   npm run search:baseline -- --days=30
 */
async function main() {
  resetServerEnvCache();

  const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
  const windowDays = daysArg
    ? Number.parseInt(daysArg.split("=")[1] ?? "", 10)
    : 30;

  if (!Number.isFinite(windowDays) || windowDays < 1) {
    console.error("--days must be a positive integer");
    process.exitCode = 1;
    return;
  }

  const { db, close } = createScriptDb();

  try {
    const report = await buildSearchBaseline(db, { windowDays, topN: 100 });
    console.log(JSON.stringify({ ok: true, baseline: report }, null, 2));
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
