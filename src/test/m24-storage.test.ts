import { describe, expect, it } from "vitest";

import { shouldCacheCourseImage } from "@/domain/storage/cache-policy";
import { FakeObjectStorageProvider } from "@/domain/storage/fake-provider";
import {
  assertSafeStorageKey,
  buildStorageKey,
  sha256Hex,
} from "@/domain/storage/keys";
import { validateManagedUpload } from "@/domain/storage/managed-asset-service";

function pngBytes(): Buffer {
  // Minimal PNG header + IHDR-ish bytes for magic sniff.
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
  ]);
}

describe("M24 storage keys", () => {
  it("builds non-user-controlled object keys", () => {
    const key = buildStorageKey({
      assetType: "COURSE_OVERRIDE",
      mimeType: "image/webp",
      entityId: "course-123",
    });
    expect(key).toMatch(/^courses\/course-123\/override\/.+\.webp$/);
    expect(key.includes("..")).toBe(false);
  });

  it("rejects path traversal keys", () => {
    expect(() => assertSafeStorageKey("../etc/passwd")).toThrow();
    expect(() => assertSafeStorageKey("/abs")).toThrow();
  });

  it("hashes content stably", () => {
    const a = sha256Hex(Buffer.from("abc"));
    const b = sha256Hex(Buffer.from("abc"));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe("M24 upload validation", () => {
  it("accepts PNG magic bytes even if client MIME is wrong", () => {
    const result = validateManagedUpload({
      assetType: "COURSE_OVERRIDE",
      claimedMime: "application/octet-stream",
      bytes: pngBytes(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mime).toBe("image/png");
  });

  it("rejects non-image payloads", () => {
    const result = validateManagedUpload({
      assetType: "COURSE_OVERRIDE",
      claimedMime: "image/png",
      bytes: Buffer.from("not-an-image"),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects SVG", () => {
    const result = validateManagedUpload({
      assetType: "COURSE_OVERRIDE",
      claimedMime: "image/svg+xml",
      bytes: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
    });
    expect(result.ok).toBe(false);
  });
});

describe("M24 cache policy", () => {
  it("keeps stable remotes by default", () => {
    expect(
      shouldCacheCourseImage({
        imageSourceType: "OFFICIAL",
        imagePolicy: "REMOTE_ONLY",
        imageStatus: "OK",
        sourceUrl: "https://cdn.example.com/course.jpg",
      }).action,
    ).toBe("KEEP_REMOTE");
  });

  it("caches fragile signed URLs", () => {
    const decision = shouldCacheCourseImage({
      imageSourceType: "TRUSTED_METADATA",
      imagePolicy: "REMOTE_ONLY",
      imageStatus: "OK",
      sourceUrl:
        "https://cdn.example.com/x.jpg?X-Amz-Signature=abc&Expires=1",
    });
    expect(decision.action).toBe("CACHE");
  });

  it("honors STORE_COPY policy", () => {
    expect(
      shouldCacheCourseImage({
        imageSourceType: "OFFICIAL",
        imagePolicy: "STORE_COPY",
        imageStatus: "OK",
        sourceUrl: "https://cdn.example.com/a.jpg",
      }).action,
    ).toBe("CACHE");
  });
});

describe("M24 fake object storage", () => {
  it("puts, exists, deletes, and builds public URLs", async () => {
    const storage = new FakeObjectStorageProvider("https://cdn.test");
    const key = "courses/x/override/a.webp";
    await storage.put({
      key,
      bytes: Buffer.from("hi"),
      contentType: "image/webp",
    });
    expect(await storage.exists(key)).toBe(true);
    expect(storage.getPublicUrl(key)).toBe("https://cdn.test/courses/x/override/a.webp");
    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });
});
