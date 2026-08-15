import { NextResponse } from "next/server";

import {
  getCourseMediaOverride,
  resolveCourseOverridePresentationUrl,
} from "@/domain/media/course-image-override";
import { withDb } from "@/lib/db-safe";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { courseId } = await context.params;
  if (!courseId || !/^[0-9a-f-]{36}$/i.test(courseId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const resolved = await withDb(
    "course-media.resolve",
    (db) => resolveCourseOverridePresentationUrl(db, courseId),
    null,
  );

  // Managed / remote URLs redirect; avoid proxying object storage through the app.
  if (resolved && /^https:\/\//i.test(resolved)) {
    return NextResponse.redirect(resolved, 302);
  }

  const asset = await withDb(
    "course-media.get",
    (db) => getCourseMediaOverride(db, courseId),
    null,
  );

  if (!asset?.bytes || !asset.contentType) {
    if (asset?.remoteUrl) {
      return NextResponse.redirect(asset.remoteUrl, 302);
    }
    return new NextResponse("Not found", { status: 404 });
  }

  const body = Buffer.isBuffer(asset.bytes)
    ? asset.bytes
    : Buffer.from(asset.bytes as unknown as ArrayBuffer);

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.byteLength ?? body.byteLength),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}

export const dynamic = "force-dynamic";
