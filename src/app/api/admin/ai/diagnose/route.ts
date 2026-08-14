import { NextResponse } from "next/server";

import {
  forbiddenResponse,
  getSession,
  unauthorizedResponse,
} from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAIProvider } from "@/services/ai/nvidia-nim-provider";

/** One live model call; the platform default would kill it mid-flight. */
export const maxDuration = 60;

/**
 * A tiny, self-contained sample so the check measures the model round-trip
 * rather than the quality of a real candidate's scraped content.
 */
const SAMPLE = {
  url: "https://www.example-provider.com/course/intro-to-python",
  title: "Introduction to Python Programming",
  description:
    "A beginner course covering Python syntax, data types, and functions. Audit this course for free; the certificate requires payment.",
  providerHint: "Example Provider",
  content:
    "This 6-hour beginner course teaches Python basics. You can audit all lessons for free. A verified certificate is available for $49.",
};

export async function POST() {
  const session = await getSession();
  if (!session) return unauthorizedResponse();
  if (session.role !== "ADMIN") {
    return forbiddenResponse("ADMIN role required");
  }

  const env = getServerEnv();
  const model = env.NVIDIA_MODEL || "(default)";

  if (!env.NVIDIA_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        model,
        stage: "config",
        error: "NVIDIA_API_KEY is not set on this deployment",
      },
      { status: 200 },
    );
  }

  const startedAt = Date.now();
  try {
    const provider = createAIProvider();
    const analysis = await provider.analyzeCourse(SAMPLE);
    const latencyMs = Date.now() - startedAt;

    logger.info("ai.diagnose", { status: "ok", model, latencyMs });

    return NextResponse.json({
      ok: true,
      model,
      latencyMs,
      timeoutMs: env.AI_REQUEST_TIMEOUT_MS,
      sample: {
        title: analysis.title,
        price_type: analysis.price_type,
        certificate_type: analysis.certificate_type,
        confidence: analysis.confidence,
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : "Unknown error";

    logger.error("ai.diagnose", { status: "error", model, latencyMs, message });

    return NextResponse.json(
      {
        ok: false,
        model,
        latencyMs,
        timeoutMs: env.AI_REQUEST_TIMEOUT_MS,
        error: message,
      },
      { status: 200 },
    );
  }
}
