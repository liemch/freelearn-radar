import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  enqueuePublishedCourses,
  getEmbeddingQueueSnapshot,
  runEmbeddingBatch,
} from "@/domain/embedding/embed-batch";
import { getSession } from "@/lib/auth/guards";
import { assertEditor, authzResponse } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

export const maxDuration = 120;

const bodySchema = z.object({
  action: z.enum(["status", "enqueue", "run"]).default("status"),
});

export async function GET() {
  try {
    const session = await getSession();
    assertEditor(session);
    const db = getDb();
    const queue = await getEmbeddingQueueSnapshot(db);
    return NextResponse.json({ queue });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    assertEditor(session);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const db = getDb();
    const { action } = parsed.data;

    if (action === "enqueue") {
      const enqueued = await enqueuePublishedCourses(db);
      const queue = await getEmbeddingQueueSnapshot(db);
      return NextResponse.json({ enqueued, queue });
    }

    if (action === "run") {
      const summary = await runEmbeddingBatch(db);
      const queue = await getEmbeddingQueueSnapshot(db);
      return NextResponse.json({ summary, queue });
    }

    const queue = await getEmbeddingQueueSnapshot(db);
    return NextResponse.json({ queue });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;

    logger.error("admin.embeddings", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
