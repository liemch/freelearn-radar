import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { analyzePendingCandidates } from "@/domain/candidate/analyze-candidate";
import { fetchPendingCandidates } from "@/domain/candidate/fetch-candidate-source";
import { runDiscoveryBatch } from "@/domain/discovery/discovery-engine";
import {
  getSession,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAIProvider } from "@/services/ai/nvidia-nim-provider";
import { createSearchProvider } from "@/services/search/tavily-search-provider";

/** Manual run: search + fetch + analyze (same pipeline as cron). */
export const maxDuration = 300;

const bodySchema = z.object({
  provider: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
  resultLimit: z.number().int().positive().max(10).optional(),
  ignoreSchedule: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (session.role !== "ADMIN") {
    return forbiddenResponse("ADMIN role required");
  }

  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const env = getServerEnv();

    if (!env.TAVILY_API_KEY) {
      return NextResponse.json(
        {
          error: "TAVILY_API_KEY is not configured",
          pendingManualIntegrationTest: true,
        },
        { status: 503 },
      );
    }

    const db = getDb();
    const searchProvider = createSearchProvider();
    const queryLimit = Math.min(
      body.limit ?? 25,
      env.DISCOVERY_QUERY_LIMIT,
    );
    const summary = await runDiscoveryBatch(db, searchProvider, {
      queryLimit,
      resultLimit: body.resultLimit ?? env.DISCOVERY_RESULT_LIMIT,
      provider: body.provider,
      category: body.category,
      ignoreSchedule: body.ignoreSchedule ?? false,
    });

    const fetched = await fetchPendingCandidates(
      db,
      env.MAX_SOURCE_FETCHES_PER_RUN,
      {
        timeoutMs: env.SOURCE_FETCH_TIMEOUT_MS,
        maxRedirects: env.SOURCE_MAX_REDIRECTS,
        maxBytes: env.SOURCE_MAX_RESPONSE_BYTES,
      },
    );

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

    const after = {
      ...summary,
      sourceFetched: fetched.length,
      analyzed,
    };

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "DISCOVERY_RUN",
      entityType: "discovery",
      entityId: body.provider ?? body.category ?? "batch",
      after,
    });

    logger.info("admin.discovery.run", {
      status: "success",
      userId: session.userId,
      provider: body.provider ?? null,
      category: body.category ?? null,
      ...after,
    });

    return NextResponse.json({
      ok: true,
      summary: after,
      pendingManualIntegrationTest: !env.NVIDIA_API_KEY,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    logger.error("admin.discovery.run", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ error: "Discovery failed" }, { status: 500 });
  }
}
