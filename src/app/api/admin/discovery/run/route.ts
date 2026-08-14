import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { runDiscoveryBatch } from "@/domain/discovery/discovery-engine";
import {
  getSession,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSearchProvider } from "@/services/search/tavily-search-provider";

const bodySchema = z.object({
  provider: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().int().positive().max(30).optional(),
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
    const summary = await runDiscoveryBatch(db, searchProvider, {
      queryLimit: body.limit ?? 5,
      resultLimit: body.resultLimit ?? env.DISCOVERY_RESULT_LIMIT,
      provider: body.provider,
      category: body.category,
      ignoreSchedule: body.ignoreSchedule ?? false,
    });

    logger.info("admin.discovery.run", {
      status: "success",
      userId: session.userId,
      provider: body.provider ?? null,
      category: body.category ?? null,
      ...summary,
    });

    return NextResponse.json({ ok: true, summary });
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
