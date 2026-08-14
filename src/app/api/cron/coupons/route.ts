import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { runCouponDiscovery } from "@/domain/coupon/coupon-discovery-runner";
import { runCouponVerification } from "@/domain/coupon/coupon-verification-runner";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Aggregator discovery + bounded official verification. */
export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const env = getServerEnv();
  if (!verifyCronAuth(request.headers, env.CRON_SECRET)) {
    return unauthorized();
  }

  try {
    if (env.FEATURE_COUPON_DISCOVERY !== "true") {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "FEATURE_COUPON_DISCOVERY_off",
      });
    }

    const db = getDb();
    const discovery = await runCouponDiscovery(db);
    const verification = await runCouponVerification(db);

    await writeAuditLog(db, {
      actorType: "CRON",
      action: "COUPON_RUN",
      entityType: "coupon",
      entityId: "cron",
      after: { discovery, verification },
    });

    logger.info("cron.coupons", {
      status: "success",
      discovery,
      verification,
    });

    return NextResponse.json({
      ok: true,
      discovery,
      verification,
    });
  } catch (error) {
    logger.error("cron.coupons", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Coupon cron failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
