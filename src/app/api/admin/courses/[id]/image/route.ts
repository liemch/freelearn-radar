import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { findCourseById } from "@/db/repositories/course-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { resolveCourseMediaById } from "@/domain/media/media-resolution-runner";
import {
  clearCourseImageOverride,
  setCourseImageRemoteOverride,
  setCourseImageUploadOverride,
} from "@/domain/media/course-image-override";
import { getSession } from "@/lib/auth/guards";
import { assertEditor, authzResponse } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const urlSchema = z.object({
  action: z.literal("set_url"),
  url: z.string().url().max(2048),
});

const clearSchema = z.object({
  action: z.literal("clear"),
});

const resolveSchema = z.object({
  action: z.literal("resolve"),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    assertEditor(session);
    const { id } = await context.params;
    const db = getDb();
    const course = await findCourseById(db, id);
    if (!course) {
      return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const action = String(form.get("action") ?? "upload");
      if (action === "clear") {
        await clearCourseImageOverride(db, id);
        await writeAuditLog(db, {
          actorType: "USER",
          actorId: session.userId,
          action: "COURSE_IMAGE_OVERRIDE_CLEAR",
          entityType: "course",
          entityId: id,
          before: { imageOverrideUrl: course.imageOverrideUrl },
          after: { imageOverrideUrl: null },
        });
        return NextResponse.json({ ok: true });
      }

      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Thiếu tệp ảnh." }, { status: 400 });
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const result = await setCourseImageUploadOverride(db, {
        courseId: id,
        contentType: file.type || "application/octet-stream",
        bytes,
        originalFilename: file.name,
      });
      await writeAuditLog(db, {
        actorType: "USER",
        actorId: session.userId,
        action: "COURSE_IMAGE_OVERRIDE_UPLOAD",
        entityType: "course",
        entityId: id,
        before: { imageOverrideUrl: course.imageOverrideUrl },
        after: {
          imageOverrideUrl: result.overrideUrl,
          byteLength: bytes.byteLength,
          contentType: file.type,
        },
      });
      return NextResponse.json({ ok: true, overrideUrl: result.overrideUrl });
    }

    const body = await request.json().catch(() => null);
    const asUrl = urlSchema.safeParse(body);
    if (asUrl.success) {
      const result = await setCourseImageRemoteOverride(db, id, asUrl.data.url);
      await writeAuditLog(db, {
        actorType: "USER",
        actorId: session.userId,
        action: "COURSE_IMAGE_OVERRIDE_URL",
        entityType: "course",
        entityId: id,
        before: { imageOverrideUrl: course.imageOverrideUrl },
        after: { imageOverrideUrl: result.overrideUrl },
      });
      return NextResponse.json({ ok: true, overrideUrl: result.overrideUrl });
    }

    const asClear = clearSchema.safeParse(body);
    if (asClear.success) {
      await clearCourseImageOverride(db, id);
      await writeAuditLog(db, {
        actorType: "USER",
        actorId: session.userId,
        action: "COURSE_IMAGE_OVERRIDE_CLEAR",
        entityType: "course",
        entityId: id,
        before: { imageOverrideUrl: course.imageOverrideUrl },
        after: { imageOverrideUrl: null },
      });
      return NextResponse.json({ ok: true });
    }

    const asResolve = resolveSchema.safeParse(body);
    if (asResolve.success) {
      const summary = await resolveCourseMediaById(db, id);
      await writeAuditLog(db, {
        actorType: "USER",
        actorId: session.userId,
        action: "COURSE_IMAGE_RESOLVE",
        entityType: "course",
        entityId: id,
        after: summary,
      });
      const refreshed = await findCourseById(db, id);
      return NextResponse.json({ ok: true, course: refreshed, summary });
    }

    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  } catch (error) {
    const authz = authzResponse(error);
    if (authz) return authz;
    logger.error("admin.course.image", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Không cập nhật được ảnh",
      },
      { status: 400 },
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;
