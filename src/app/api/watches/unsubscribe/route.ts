import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { unsubscribeWatch } from "@/domain/alerts/watch-service";
import { getServerEnv } from "@/lib/env";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const watch = await unsubscribeWatch(getDb(), token);
    if (!watch) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const env = getServerEnv();
    const locale = watch.locale === "vi" ? "vi" : "en";
    const appUrl = env.APP_URL.replace(/\/$/, "");
    return NextResponse.redirect(`${appUrl}/${locale}?watch=unsubscribed`);
  } catch {
    return NextResponse.json({ error: "Unsubscribe failed" }, { status: 400 });
  }
}
