import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/db";
import { getCourseDetailBySlug } from "@/db/repositories/course-repository";
import { recordOutboundClick } from "@/db/repositories/outbound-click-repository";
import { buildOutboundUrl } from "@/domain/ranking/ranking";
import { logger } from "@/lib/logger";
import { assertSafeHttpUrl } from "@/lib/url";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  try {
    const db = getDb();
    const course = await getCourseDetailBySlug(db, slug);

    if (!course || (course.status !== "PUBLISHED" && course.status !== "EXPIRED" && course.status !== "UNAVAILABLE")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    let destination: string;
    try {
      destination = assertSafeHttpUrl(
        buildOutboundUrl(course, course.provider),
      );
    } catch (error) {
      logger.error("outbound.click", {
        status: "unsafe_url",
        slug,
        error: error instanceof Error ? error.message : "Unsafe URL",
      });
      return NextResponse.redirect(new URL(`/course/${slug}`, request.url));
    }

    try {
      await recordOutboundClick(db, {
        courseId: course.id,
        providerId: course.providerId,
        referrer: request.headers.get("referer"),
        utmSource: request.nextUrl.searchParams.get("utm_source"),
      });
    } catch (clickError) {
      // Never block the learner redirect on analytics failure
      logger.warn("outbound.click", {
        status: "click_record_failed",
        courseId: course.id,
        error:
          clickError instanceof Error ? clickError.message : "Unknown error",
      });
    }

    logger.info("outbound.click", {
      status: "success",
      courseId: course.id,
      providerId: course.providerId,
    });

    return NextResponse.redirect(destination, 302);
  } catch (error) {
    logger.error("outbound.click", {
      status: "error",
      slug,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.redirect(new URL("/", request.url));
  }
}
