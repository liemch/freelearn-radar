import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { runMonitorBatch } from "@/domain/monitor/run-monitor-batch";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Observes due published courses and detects confirmed price events. */
export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const env = getServerEnv();
  if (!verifyCronAuth(request.headers, env.CRON_SECRET)) {
    return unauthorized();
  }

  try {
    const db = getDb();
    const summary = await runMonitorBatch(db, {
      limit: env.MONITOR_DAILY_FETCH_BUDGET,
      concurrency: env.MONITOR_CONCURRENCY,
    });

    logger.info("cron.monitor", { status: "success", ...summary });

    return NextResponse.json({
      ok: true,
      monitor: summary,
      skippedEmpty: summary.considered === 0,
    });
  } catch (error) {
    logger.error("cron.monitor", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Monitor cron failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
