import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/guards";
import { assertAdmin, authzResponse } from "@/lib/auth/rbac";
import {
  getTechhubClient,
  isTechhubConfigured,
} from "@/services/techhub/get-client";

export async function requireTechhubAdmin() {
  const session = await getSession();
  assertAdmin(session);
  return session;
}

export function techhubErrorResponse(error: unknown): NextResponse | null {
  const authz = authzResponse(error);
  if (authz) return authz;

  if (error instanceof Error && error.message === "TECHHUB_NOT_CONFIGURED") {
    return NextResponse.json(
      { error: "TechHub Supabase chưa được cấu hình." },
      { status: 503 },
    );
  }

  return null;
}

export async function getTechhubStatusPayload() {
  if (!isTechhubConfigured()) {
    return { configured: false, connected: false };
  }

  const client = getTechhubClient();
  const connected = await client.testConnection();
  return { configured: true, connected };
}
