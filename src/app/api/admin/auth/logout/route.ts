import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

export async function POST() {
  await clearSessionCookie();

  logger.info("admin.auth.logout", { status: "success" });

  return NextResponse.json({ ok: true });
}
