import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { runLexicalBenchmark } from "@/domain/search/benchmark";
import {
  getSession,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

const bodySchema = z.object({
  datasetVersion: z.string().min(1).max(32).optional(),
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
    const db = getDb();
    const { summary, run } = await runLexicalBenchmark(db, {
      datasetVersion: body.datasetVersion ?? "v1",
    });

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "SEARCH_BENCHMARK_RUN",
      entityType: "search_benchmark_run",
      entityId: run.id,
      after: summary,
    });

    logger.info("admin.search.benchmark", {
      status: "success",
      userId: session.userId,
      runId: run.id,
      ...summary,
    });

    return NextResponse.json({ ok: true, summary, runId: run.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    logger.error("admin.search.benchmark", {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Benchmark failed",
      },
      { status: 500 },
    );
  }
}
