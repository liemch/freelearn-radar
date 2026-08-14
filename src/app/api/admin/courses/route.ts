import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  createCourse,
  findCourseByCanonicalUrl,
  findCourseBySlug,
  setCourseCategories,
} from "@/db/repositories/course-repository";
import {
  courseFormSchema,
  emptyToNull,
} from "@/domain/course/course-form";
import { assertVisibleOnPublicCatalog } from "@/domain/course/free-durability";
import {
  forbiddenResponse,
  getSession,
  unauthorizedResponse,
} from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return unauthorizedResponse();
  }

  if (session.role !== "ADMIN" && session.role !== "EDITOR") {
    return forbiddenResponse();
  }

  try {
    const body = courseFormSchema.parse(await request.json());
    const db = getDb();

    const existingSlug = await findCourseBySlug(db, body.slug);
    if (existingSlug) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 },
      );
    }

    const existingUrl = await findCourseByCanonicalUrl(db, body.canonicalUrl);
    if (existingUrl) {
      return NextResponse.json(
        { error: "Canonical URL already exists" },
        { status: 409 },
      );
    }

    const now = new Date();
    const status = body.status ?? "DRAFT";

    if (status === "PUBLISHED") {
      assertVisibleOnPublicCatalog(body.priceType);
    }

    const course = await createCourse(db, {
      title: body.title,
      slug: body.slug,
      shortDescription: emptyToNull(body.shortDescription),
      description: emptyToNull(body.description),
      providerId: body.providerId,
      canonicalUrl: body.canonicalUrl,
      outboundUrl: emptyToNull(body.outboundUrl) ?? body.canonicalUrl,
      affiliateUrl: emptyToNull(body.affiliateUrl),
      instructor: emptyToNull(body.instructor),
      language: emptyToNull(body.language),
      level: body.level,
      durationMinutes: body.durationMinutes ?? null,
      priceType: body.priceType,
      certificateType: body.certificateType,
      qualityScore: body.qualityScore ?? null,
      editorScore: body.editorScore ?? null,
      status,
      publishedAt: status === "PUBLISHED" ? now : null,
      lastVerifiedAt: status === "PUBLISHED" ? now : null,
    });

    await setCourseCategories(db, course.id, body.categoryIds);

    logger.info("admin.courses.create", {
      courseId: course.id,
      status: "success",
      userId: session.userId,
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid course payload", details: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.name === "PublicCatalogVisibilityError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error("admin.courses.create", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
