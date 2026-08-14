import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { writeAuditLog } from "@/domain/admin/audit-log";
import {
  findCourseById,
  updateCourse,
} from "@/db/repositories/course-repository";
import { assertCourseStatusTransition } from "@/domain/course/transitions";
import {
  forbiddenResponse,
  getSession,
  unauthorizedResponse,
} from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

const statusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "EXPIRED", "UNAVAILABLE", "ARCHIVED"]),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return unauthorizedResponse();
  }

  if (session.role !== "ADMIN" && session.role !== "EDITOR") {
    return forbiddenResponse();
  }

  const { id } = await context.params;

  try {
    const body = statusSchema.parse(await request.json());
    const db = getDb();
    const existing = await findCourseById(db, id);

    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    assertCourseStatusTransition(existing.status, body.status);

    const now = new Date();
    const course = await updateCourse(db, id, {
      status: body.status,
      publishedAt:
        body.status === "PUBLISHED"
          ? existing.publishedAt ?? now
          : existing.publishedAt,
      // Re-publishing is not a verification: only stamp the clock on first publication,
      // otherwise a course last checked months ago would advertise itself as fresh.
      lastVerifiedAt:
        body.status === "PUBLISHED"
          ? existing.lastVerifiedAt ?? now
          : existing.lastVerifiedAt,
    });

    await writeAuditLog(db, {
      actorType: "USER",
      actorId: session.userId,
      action: "COURSE_STATUS",
      entityType: "course",
      entityId: course.id,
      before: { status: existing.status },
      after: { status: course.status },
    });

    logger.info("admin.courses.status", {
      courseId: course.id,
      status: body.status,
      userId: session.userId,
    });

    return NextResponse.json({ course });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    if (
      error instanceof Error &&
      error.message.startsWith("Invalid course status transition")
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    logger.error("admin.courses.status", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ error: "Status update failed" }, { status: 500 });
  }
}
