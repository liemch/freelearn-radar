import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { writeAuditLog } from "@/domain/admin/audit-log";
import {
  findCourseByCanonicalUrl,
  findCourseById,
  findCourseBySlug,
  setCourseCategories,
  updateCourse,
} from "@/db/repositories/course-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import {
  courseFormSchema,
  emptyToNull,
} from "@/domain/course/course-form";
import {
  assertVisibleOnPublicCatalog,
  deriveFreeDurability,
} from "@/domain/course/free-durability";
import {
  assertCertificateResolved,
  assertPriceTypeAllowed,
} from "@/domain/verification/provider-policy";
import {
  forbiddenResponse,
  getSession,
  unauthorizedResponse,
} from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return unauthorizedResponse();
  }

  if (session.role !== "ADMIN" && session.role !== "EDITOR") {
    return forbiddenResponse();
  }

  const { id } = await context.params;

  try {
    const body = courseFormSchema.parse(await request.json());
    assertPriceTypeAllowed("MANUAL", body.priceType);
    const db = getDb();

    const existing = await findCourseById(db, id);
    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const slugOwner = await findCourseBySlug(db, body.slug);
    if (slugOwner && slugOwner.id !== id) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 },
      );
    }

    const urlOwner = await findCourseByCanonicalUrl(db, body.canonicalUrl);
    if (urlOwner && urlOwner.id !== id) {
      return NextResponse.json(
        { error: "Canonical URL already exists" },
        { status: 409 },
      );
    }

    const status = body.status ?? existing.status;

    if (status === "PUBLISHED") {
      assertVisibleOnPublicCatalog(body.priceType);
      assertCertificateResolved(body.priceType, body.certificateType);
    }

    const publishedAt =
      status === "PUBLISHED"
        ? existing.publishedAt ?? new Date()
        : existing.publishedAt;

    const providers = await listProviders(db, false);
    const provider =
      providers.find((item) => item.id === body.providerId) ??
      providers.find((item) => item.id === existing.providerId);
    const freeDurability = deriveFreeDurability(
      provider?.slug,
      body.priceType,
    );

    const course = await updateCourse(db, id, {
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
      freeDurability,
      qualityScore: body.qualityScore ?? null,
      editorScore: body.editorScore ?? null,
      status,
      publishedAt,
      lastVerifiedAt:
        status === "PUBLISHED"
          ? existing.lastVerifiedAt ?? new Date()
          : existing.lastVerifiedAt,
    });

    await setCourseCategories(db, course.id, body.categoryIds);

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "COURSE_UPDATE",
      entityType: "course",
      entityId: course.id,
      before: {
        status: existing.status,
        priceType: existing.priceType,
        certificateType: existing.certificateType,
      },
      after: {
        status: course.status,
        priceType: course.priceType,
        certificateType: course.certificateType,
      },
    });

    logger.info("admin.courses.update", {
      courseId: course.id,
      status: "success",
      userId: session.userId,
    });

    return NextResponse.json({ course });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid course payload", details: error.issues },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      (error.message.includes("FREE_WITH_COUPON") ||
        error.message.includes("FREE_AUDIT"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.name === "PublicCatalogVisibilityError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error("admin.courses.update", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
