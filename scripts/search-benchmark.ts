import "@/lib/load-env";

import { createScriptDb } from "@/db/script-db";
import { runLexicalBenchmark } from "@/domain/search/benchmark";
import { resetServerEnvCache } from "@/lib/env";

/**
 * M20.0 lexical-only benchmark stub (project plan §86.6).
 *
 *   npm run search:benchmark -- --dataset=v1
 */
async function main() {
  resetServerEnvCache();

  const datasetArg = process.argv.find((arg) => arg.startsWith("--dataset="));
  const datasetVersion = datasetArg?.split("=")[1] ?? "v1";

  const { db, close } = createScriptDb();

  try {
    const { summary, run } = await runLexicalBenchmark(db, { datasetVersion });
    console.log(
      JSON.stringify(
        {
          ok: true,
          runId: run.id,
          summary,
        },
        null,
        2,
      ),
    );
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
