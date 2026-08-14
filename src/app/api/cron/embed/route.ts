import { NextResponse } from "next/server";

import { getDb } from "@/db";
import {
  enqueuePublishedCourses,
  runEmbeddingBatch,
} from "@/domain/embedding/embed-batch";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

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
    const enqueued = await enqueuePublishedCourses(db, 500);
    const summary = await runEmbeddingBatch(db);

    logger.info("cron.embed", {
      status: "success",
      enqueued,
      ...summary,
    });

    return NextResponse.json({
      ok: true,
      enqueued,
      embedding: summary,
    });
  } catch (error) {
    logger.error("cron.embed", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Embedding cron failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
