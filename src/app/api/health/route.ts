import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deep = request.nextUrl.searchParams.get("deep") === "1";

  const payload: {
    status: "ok" | "degraded";
    service: string;
    timestamp: string;
    database?: "ok" | "error";
  } = {
    status: "ok",
    service: "freelearn-radar",
    timestamp: new Date().toISOString(),
  };

  if (deep) {
    // Liveness stays public; the database probe does not, because an anonymous
    // caller could otherwise use it to hammer the connection pool.
    const cronSecret = readCronSecret();
    if (cronSecret && !verifyCronAuth(request.headers, cronSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const db = getDb();
      await db.execute(sql`select 1`);
      payload.database = "ok";
    } catch (error) {
      payload.status = "degraded";
      payload.database = "error";
      logger.warn("health.deep", {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(payload, { status: 503 });
    }
  }

  return NextResponse.json(payload, { status: 200 });
}

/** Health must answer even when the environment fails validation. */
function readCronSecret(): string | undefined {
  try {
    return getServerEnv().CRON_SECRET || undefined;
  } catch {
    return process.env.CRON_SECRET || undefined;
  }
}
