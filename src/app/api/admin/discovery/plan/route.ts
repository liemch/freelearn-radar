import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { buildDiscoveryDryRunPlan } from "@/domain/coverage/discovery-recommendations";
import {
  forbiddenResponse,
  getSession,
  unauthorizedResponse,
} from "@/lib/auth/guards";

/**
 * M27 dry-run: returns a bounded discovery plan without mutating the catalog.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorizedResponse();
  if (session.role !== "ADMIN" && session.role !== "EDITOR") {
    return forbiddenResponse("Admin or Editor role required");
  }

  const url = new URL(request.url);
  const parsed = z
    .object({ category: z.string().min(1).max(120) })
    .safeParse({ category: url.searchParams.get("category") });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Query param category is required" },
      { status: 400 },
    );
  }

  try {
    const db = getDb();
    const plan = await buildDiscoveryDryRunPlan(db, parsed.data.category);
    if (!plan) {
      return NextResponse.json(
        { error: "No enabled discovery queries for this category" },
        { status: 404 },
      );
    }
    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable for dry-run" },
      { status: 503 },
    );
  }
}
