import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { findCourseById } from "@/db/repositories/course-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import {
  classifyPurge,
  markCourseDuplicate,
  purgeCourse,
  restoreCourse,
  snapshotCourseDependencies,
} from "@/domain/course/lifecycle";
import { getSession } from "@/lib/auth/guards";
import { assertAdmin, assertEditor, authzResponse } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const restoreSchema = z.object({ action: z.literal("restore") });
const duplicateSchema = z.object({
  action: z.literal("duplicate"),
  canonicalCourseId: z.string().uuid(),
});
const purgeSchema = z.object({
  action: z.literal("purge"),
  confirmSlug: z.string().min(1),
  reason: z.string().min(8).max(500),
  allowCascade: z.boolean().optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    assertEditor(session);
    const { id } = await context.params;
    const db = getDb();
    const deps = await snapshotCourseDependencies(db, id);
    if (!deps) {
      return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
    }
    return NextResponse.json({
      dependencies: deps,
      classification: classifyPurge(deps),
    });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    return NextResponse.json({ error: "Không đọc được phụ thuộc" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    const { id } = await context.params;
    const db = getDb();
    const course = await findCourseById(db, id);
    if (!course) {
      return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);

    const asRestore = restoreSchema.safeParse(body);
    if (asRestore.success) {
      assertEditor(session);
      await restoreCourse(db, id);
      await writeAuditLog(db, {
        actorType: "USER",
        actorId: session.userId,
        action: "RESTORE",
        entityType: "course",
        entityId: id,
        before: { status: course.status },
        after: { status: "DRAFT" },
      });
      return NextResponse.json({ ok: true, status: "DRAFT" });
    }

    const asDuplicate = duplicateSchema.safeParse(body);
    if (asDuplicate.success) {
      assertEditor(session);
      await markCourseDuplicate(db, {
        courseId: id,
        canonicalCourseId: asDuplicate.data.canonicalCourseId,
      });
      await writeAuditLog(db, {
        actorType: "USER",
        actorId: session.userId,
        action: "DUPLICATE_MARK",
        entityType: "course",
        entityId: id,
        after: {
          status: "ARCHIVED",
          duplicateOfCourseId: asDuplicate.data.canonicalCourseId,
        },
      });
      return NextResponse.json({ ok: true, status: "ARCHIVED" });
    }

    const asPurge = purgeSchema.safeParse(body);
    if (asPurge.success) {
      assertAdmin(session);
      const result = await purgeCourse(db, {
        courseId: id,
        confirmSlug: asPurge.data.confirmSlug,
        reason: asPurge.data.reason,
        allowCascade: asPurge.data.allowCascade,
      });
      await writeAuditLog(db, {
        actorType: "USER",
        actorId: session.userId,
        action: "PURGE",
        entityType: "course",
        entityId: id,
        before: {
          slug: course.slug,
          title: course.title,
          status: course.status,
        },
        after: {
          purged: true,
          classification: result.classification,
          reason: asPurge.data.reason,
        },
        reason: asPurge.data.reason,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    logger.error("admin.course.lifecycle", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Thao tác vòng đời thất bại",
      },
      { status: 400 },
    );
  }
}

export const dynamic = "force-dynamic";
