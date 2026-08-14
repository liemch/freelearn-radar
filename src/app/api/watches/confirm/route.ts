import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { confirmWatch } from "@/domain/alerts/watch-service";
import { getServerEnv } from "@/lib/env";

export async function GET(request: Request) {
  try {
    const env = getServerEnv();
    if (env.FEATURE_PRICE_ALERTS !== "true") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const token = new URL(request.url).searchParams.get("token") ?? "";
    const watch = await confirmWatch(getDb(), token);
    if (!watch) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const locale = watch.locale === "vi" ? "vi" : "en";
    const appUrl = env.APP_URL.replace(/\/$/, "");
    const redirectTo = `${appUrl}/${locale}?watch=confirmed`;

    return NextResponse.redirect(redirectTo);
  } catch {
    return NextResponse.json({ error: "Confirm failed" }, { status: 400 });
  }
}
