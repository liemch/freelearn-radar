import "@/lib/load-env";

import { createScriptDb } from "@/db/script-db";
import { replayEvents } from "@/domain/monitor/replay-events";
import { resetServerEnvCache } from "@/lib/env";

/**
 * STOP 3 gate evidence (project plan §73): replay stored observations through the
 * live confirmation rules and report what would have fired.
 *
 * Read-only. Makes no HTTP request, writes no row, sends no email.
 *
 *   npm run replay:events -- --days=30
 */
async function main() {
  resetServerEnvCache();

  const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
  const windowDays = daysArg ? Number.parseInt(daysArg.split("=")[1] ?? "", 10) : 30;

  if (!Number.isFinite(windowDays) || windowDays < 1) {
    console.error("--days must be a positive integer");
    process.exitCode = 1;
    return;
  }

  const { db, close } = createScriptDb();

  try {
    const summary = await replayEvents(db, { windowDays });

    console.log(
      JSON.stringify(
        {
          ok: true,
          replay: {
            ...summary,
            // The full list can be long; the caller can widen this if needed.
            events: summary.events.slice(0, 50),
            eventsTruncated: Math.max(0, summary.events.length - 50),
          },
        },
        null,
        2,
      ),
    );

    if (summary.observationsMissingRegion > 0) {
      console.warn(
        `\n${summary.observationsMissingRegion} observation(s) carry no observed_region and can never confirm an event. ` +
          "Set MONITOR_OBSERVED_REGION and let the monitor build fresh history before treating this replay as a pass.",
      );
    }

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
