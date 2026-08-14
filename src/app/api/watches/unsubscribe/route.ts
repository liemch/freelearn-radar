import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { unsubscribeWatch } from "@/domain/alerts/watch-service";
import { getServerEnv } from "@/lib/env";

/**
 * Links carry the watch id plus a token derived from it, so no credential is
 * stored and the link keeps working for the life of the subscription.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const watchId = params.get("w") ?? "";
    const token = params.get("t") ?? "";

    const watch = await unsubscribeWatch(getDb(), watchId, token);
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

/**
 * RFC 8058 one-click unsubscribe: mail clients POST to the List-Unsubscribe-Post
 * URL without a human ever seeing the page.
 */
export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const watch = await unsubscribeWatch(
    getDb(),
    params.get("w") ?? "",
    params.get("t") ?? "",
  );

  return watch
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: "Invalid token" }, { status: 400 });
}
