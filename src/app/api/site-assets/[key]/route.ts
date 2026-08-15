import { NextResponse } from "next/server";

import { getSiteAsset } from "@/db/repositories/site-branding-repository";
import { withDb } from "@/lib/db-safe";

type RouteContext = { params: Promise<{ key: string }> };

/**
 * Public read path for Admin-managed branding assets.
 * Cache-friendly with version query from the branding resolver.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { key } = await context.params;
  if (!key || key.length > 64 || !/^[a-z0-9_-]+$/i.test(key)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const asset = await withDb(
    "site-assets.get",
    (db) => getSiteAsset(db, key),
    null,
  );

  if (!asset) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = Buffer.isBuffer(asset.bytes)
    ? asset.bytes
    : Buffer.from(asset.bytes as unknown as ArrayBuffer);

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.byteLength),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}

// Ensure the route is not statically locked to an empty 404 at build time.
export const dynamic = "force-dynamic";
