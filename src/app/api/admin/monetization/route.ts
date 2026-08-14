import { NextResponse } from "next/server";

import { getDb } from "@/db";
import {
  affiliateClickStats,
  listAffiliateProviders,
} from "@/db/repositories/affiliate-repository";
import { getSession } from "@/lib/auth/guards";
import { assertEditor, authzResponse } from "@/lib/auth/rbac";
import { getServerEnv } from "@/lib/env";

export async function GET() {
  try {
    const session = await getSession();
    assertEditor(session);
    const db = getDb();
    const env = getServerEnv();
    const [providers, clicks] = await Promise.all([
      listAffiliateProviders(db),
      affiliateClickStats(db, 30),
    ]);

    return NextResponse.json({
      flags: {
        monetization: env.FEATURE_MONETIZATION === "true",
        courseAffiliate: env.FEATURE_COURSE_AFFILIATE === "true",
        commerceAffiliate: env.FEATURE_COMMERCE_AFFILIATE === "true",
      },
      providers,
      clicks,
    });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
