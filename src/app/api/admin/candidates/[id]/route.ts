import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { analyzeCandidate } from "@/domain/candidate/analyze-candidate";
import {
  approveCandidate,
  rejectCandidate,
} from "@/domain/candidate/approve-candidate";
import {
  forbiddenResponse,
  getSession,
  unauthorizedResponse,
} from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAIProvider } from "@/services/ai/nvidia-nim-provider";

type RouteContext = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: unauthorizedResponse() as NextResponse };
  if (session.role !== "ADMIN") {
    return { error: forbiddenResponse("ADMIN role required") as NextResponse };
  }
  return { session };
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    reason?: string;
    overrides?: Record<string, unknown>;
  };

  try {
    const db = getDb();

    if (body.action === "reject") {
      const candidate = await rejectCandidate(db, id, body.reason);
      return NextResponse.json({ candidate });
    }

    if (body.action === "reanalyze") {
      const env = getServerEnv();
      if (!env.NVIDIA_API_KEY) {
        return NextResponse.json(
          {
            error: "NVIDIA_API_KEY is not configured",
            pendingManualIntegrationTest: true,
          },
          { status: 503 },
        );
      }
      const candidate = await analyzeCandidate(db, createAIProvider(), id, {
        force: true,
      });
      return NextResponse.json({ candidate });
    }

    if (body.action === "approve") {
      const overridesSchema = z
        .object({
          title: z.string().optional(),
          slug: z.string().optional(),
          shortDescription: z.string().optional(),
          description: z.string().optional(),
          providerId: z.string().uuid().optional(),
          categoryIds: z.array(z.string().uuid()).optional(),
          priceType: z
            .enum([
              "FREE_FULL",
              "FREE_AUDIT",
              "FREE_WITH_COUPON",
              "TEMPORARILY_FREE",
              "FREE_TRIAL",
              "PAID",
              "UNKNOWN",
            ])
            .optional(),
          certificateType: z
            .enum([
              "FREE_CERTIFICATE",
              "PAID_CERTIFICATE",
              "NO_CERTIFICATE",
              "UNKNOWN",
            ])
            .optional(),
          level: z
            .enum([
              "BEGINNER",
              "INTERMEDIATE",
              "ADVANCED",
              "ALL_LEVELS",
              "UNKNOWN",
            ])
            .optional(),
          language: z.string().optional(),
          durationMinutes: z.number().int().nullable().optional(),
          qualityScore: z.number().int().min(0).max(100).nullable().optional(),
          instructor: z.string().optional(),
        })
        .optional();

      const overrides = overridesSchema.parse(body.overrides);
      const course = await approveCandidate(db, {
        candidateId: id,
        overrides,
      });
      return NextResponse.json({ course });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    logger.error("admin.candidates.action", {
      status: "error",
      candidateId: id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Action failed",
      },
      { status: 400 },
    );
  }
}
