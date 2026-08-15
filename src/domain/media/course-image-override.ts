import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import {
  COURSE_MEDIA_ALLOWED_MIME,
  COURSE_MEDIA_MAX_BYTES,
  courseMediaOverrides,
} from "@/db/schema/course-media-overrides";
import { courses } from "@/db/schema/courses";
import { validateImageUrl } from "@/services/images/course-image-service";
import { fetchCourseImageSafely } from "@/services/images/course-image-service";

export function courseMediaPublicUrl(
  courseId: string,
  updatedAt?: Date | null,
): string {
  const version = updatedAt ? updatedAt.getTime() : Date.now();
  return `/api/course-media/${encodeURIComponent(courseId)}?v=${version}`;
}

export async function setCourseImageRemoteOverride(
  db: Db,
  courseId: string,
  rawUrl: string,
): Promise<{ overrideUrl: string }> {
  const validated = validateImageUrl(rawUrl);
  if (!validated) {
    throw new Error("URL ảnh không hợp lệ hoặc không an toàn (SSRF).");
  }

  const fetched = await fetchCourseImageSafely(validated.toString());
  if (!fetched.ok) {
    throw new Error(`Không tải được ảnh từ URL: ${fetched.reason}`);
  }

  if (!COURSE_MEDIA_ALLOWED_MIME.has(fetched.contentType.split(";")[0]!.trim())) {
    throw new Error("Định dạng ảnh không được hỗ trợ. Chỉ PNG, JPEG, WebP.");
  }

  if (fetched.bytes.byteLength > COURSE_MEDIA_MAX_BYTES) {
    throw new Error(
      `Ảnh vượt giới hạn ${Math.round(COURSE_MEDIA_MAX_BYTES / 1024)} KB.`,
    );
  }

  // Store validated remote URL as presentation override; keep source evidence.
  await db
    .insert(courseMediaOverrides)
    .values({
      courseId,
      remoteUrl: fetched.finalUrl,
      contentType: fetched.contentType,
      bytes: null,
      byteLength: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: courseMediaOverrides.courseId,
      set: {
        remoteUrl: fetched.finalUrl,
        contentType: fetched.contentType,
        bytes: null,
        byteLength: null,
        originalFilename: null,
        updatedAt: new Date(),
      },
    });

  await db
    .update(courses)
    .set({
      imageOverrideUrl: fetched.finalUrl,
      imageSourceType: "ADMIN_OVERRIDE",
      imageStatus: "OK",
      imageFallbackReason: null,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, courseId));

  return { overrideUrl: fetched.finalUrl };
}

export async function setCourseImageUploadOverride(
  db: Db,
  input: {
    courseId: string;
    contentType: string;
    bytes: Buffer;
    originalFilename?: string | null;
  },
): Promise<{ overrideUrl: string }> {
  const mime = input.contentType.split(";")[0]!.trim();
  if (!COURSE_MEDIA_ALLOWED_MIME.has(mime)) {
    throw new Error("Định dạng ảnh không được hỗ trợ. Chỉ PNG, JPEG, WebP.");
  }
  if (
    input.bytes.byteLength <= 0 ||
    input.bytes.byteLength > COURSE_MEDIA_MAX_BYTES
  ) {
    throw new Error(
      `Ảnh vượt giới hạn ${Math.round(COURSE_MEDIA_MAX_BYTES / 1024)} KB.`,
    );
  }

  const now = new Date();
  await db
    .insert(courseMediaOverrides)
    .values({
      courseId: input.courseId,
      contentType: mime,
      bytes: input.bytes,
      byteLength: input.bytes.byteLength,
      remoteUrl: null,
      originalFilename: input.originalFilename ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: courseMediaOverrides.courseId,
      set: {
        contentType: mime,
        bytes: input.bytes,
        byteLength: input.bytes.byteLength,
        remoteUrl: null,
        originalFilename: input.originalFilename ?? null,
        updatedAt: now,
      },
    });

  const overrideUrl = courseMediaPublicUrl(input.courseId, now);
  await db
    .update(courses)
    .set({
      imageOverrideUrl: overrideUrl,
      imageSourceType: "ADMIN_OVERRIDE",
      imageStatus: "OK",
      imageFallbackReason: null,
      updatedAt: now,
    })
    .where(eq(courses.id, input.courseId));

  return { overrideUrl };
}

/** Clears Admin override; automatic pipeline URLs become active again. */
export async function clearCourseImageOverride(
  db: Db,
  courseId: string,
): Promise<void> {
  await db
    .delete(courseMediaOverrides)
    .where(eq(courseMediaOverrides.courseId, courseId));

  const rows = await db
    .select({
      imageSourceUrl: courses.imageSourceUrl,
      imageResolvedUrl: courses.imageResolvedUrl,
      imageStorageUrl: courses.imageStorageUrl,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  const row = rows[0];
  const hasAutomatic =
    Boolean(row?.imageResolvedUrl) ||
    Boolean(row?.imageStorageUrl) ||
    Boolean(row?.imageSourceUrl);

  await db
    .update(courses)
    .set({
      imageOverrideUrl: null,
      // Leave source evidence intact; reset presentation status.
      imageSourceType: hasAutomatic ? "TRUSTED_METADATA" : "NONE",
      imageStatus: hasAutomatic ? "PENDING" : "MISSING",
      updatedAt: new Date(),
    })
    .where(eq(courses.id, courseId));
}

export async function getCourseMediaOverride(db: Db, courseId: string) {
  const rows = await db
    .select()
    .from(courseMediaOverrides)
    .where(eq(courseMediaOverrides.courseId, courseId))
    .limit(1);
  return rows[0] ?? null;
}
