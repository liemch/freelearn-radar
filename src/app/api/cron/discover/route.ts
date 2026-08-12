import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { runDiscoveryBatch } from "@/domain/discovery/discovery-engine";
import { analyzePendingCandidates } from "@/domain/candidate/analyze-candidate";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAIProvider } from "@/services/ai/nvidia-nim-provider";
import { createSearchProvider } from "@/services/search/tavily-search-provider";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const env = getServerEnv();
  if (!verifyCronAuth(request.headers, env.CRON_SECRET)) {
    return unauthorized();
  }

  try {
    if (!env.TAVILY_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "TAVILY_API_KEY is not configured",
          pendingManualIntegrationTest: true,
        },
        { status: 503 },
      );
    }

    const db = getDb();
    const searchProvider = createSearchProvider();
    const summary = await runDiscoveryBatch(db, searchProvider, {
      queryLimit: env.DISCOVERY_QUERY_LIMIT,
      resultLimit: env.DISCOVERY_RESULT_LIMIT,
    });

    let analyzed = 0;
    if (env.NVIDIA_API_KEY) {
      const ai = createAIProvider();
      const results = await analyzePendingCandidates(
        db,
        ai,
        env.AI_ANALYSIS_LIMIT,
      );
      analyzed = results.length;
    }

    logger.info("cron.discover", {
      status: "success",
      ...summary,
      analyzed,
    });

    return NextResponse.json({
      ok: true,
      discovery: summary,
      analyzed,
      pendingManualIntegrationTest: !env.NVIDIA_API_KEY,
    });
  } catch (error) {
    logger.error("cron.discover", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Discovery cron failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
