import "@/lib/load-env";

import { createScriptDb } from "@/db/script-db";
import { runMonitorBatch } from "@/domain/monitor/run-monitor-batch";
import { getServerEnv, resetServerEnvCache } from "@/lib/env";

async function main() {
  resetServerEnvCache();
  const env = getServerEnv();
  const { db, close } = createScriptDb();

  try {
    const summary = await runMonitorBatch(db, {
      limit: env.MONITOR_DAILY_FETCH_BUDGET,
      concurrency: env.MONITOR_CONCURRENCY,
    });

    console.log(JSON.stringify({ ok: true, monitor: summary }, null, 2));
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
