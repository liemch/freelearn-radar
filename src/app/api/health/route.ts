import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/db";
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
