import { describe, expect, it, vi } from "vitest";

import {
  fetchCourseImageSafely,
  ingestCourseImage,
  MemoryCourseImageStorage,
  validateImageUrl,
} from "@/services/images/course-image-service";

describe("course image security", () => {
  it("rejects non-http(s) and private URLs", () => {
    expect(validateImageUrl("file:///etc/passwd")).toBeNull();
    expect(validateImageUrl("javascript:alert(1)")).toBeNull();
    expect(validateImageUrl("http://127.0.0.1/logo.png")).toBeNull();
    expect(validateImageUrl("http://localhost/thumb.jpg")).toBeNull();
    expect(validateImageUrl("http://169.254.169.254/latest/meta-data")).toBeNull();
  });

  it("accepts public https URLs", () => {
    const url = validateImageUrl("https://cdn.example.com/course.jpg");
    expect(url?.hostname).toBe("cdn.example.com");
  });

  it("blocks redirect to private host", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      url: "http://127.0.0.1/evil.png",
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    })) as unknown as typeof fetch;

    const result = await fetchCourseImageSafely(
      "https://cdn.example.com/safe.png",
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("redirect_blocked");
    }
  });

  it("rejects non-image content type", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      url: "https://cdn.example.com/page",
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    })) as unknown as typeof fetch;

    const result = await fetchCourseImageSafely(
      "https://cdn.example.com/page",
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_content_type");
    }
  });

  it("rejects oversized payloads", async () => {
    const big = new Uint8Array(3 * 1024 * 1024);
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      url: "https://cdn.example.com/big.png",
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => big.buffer,
    })) as unknown as typeof fetch;

    const result = await fetchCourseImageSafely(
      "https://cdn.example.com/big.png",
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_large");
    }
  });
});

describe("course image ingestion", () => {
  it("does not fail publish path when fetch fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;

    const meta = await ingestCourseImage({
      courseId: "c1",
      sourceUrl: "https://cdn.example.com/thumb.jpg",
      fetchImpl,
    });

    expect(meta.sourceUrl).toBe("https://cdn.example.com/thumb.jpg");
    expect(meta.storageUrl).toBeNull();
    expect(meta.lastVerifiedAt).toBeInstanceOf(Date);
  });

  it("stores copy when policy allows and storage succeeds", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      url: "https://cdn.example.com/thumb.jpg",
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer,
    })) as unknown as typeof fetch;

    const meta = await ingestCourseImage({
      courseId: "c2",
      sourceUrl: "https://cdn.example.com/thumb.jpg",
      policy: "STORE_COPY",
      storage: new MemoryCourseImageStorage(),
      fetchImpl,
    });

    expect(meta.storageUrl).toMatch(/^memory:\/\//);
    expect(meta.policy).toBe("STORE_COPY");
  });

  it("uses remote-only when storage fails silently", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      url: "https://cdn.example.com/thumb.webp",
      headers: new Headers({ "content-type": "image/webp" }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    })) as unknown as typeof fetch;

    const meta = await ingestCourseImage({
      courseId: "c3",
      sourceUrl: "https://cdn.example.com/thumb.webp",
      policy: "REMOTE_ONLY",
      fetchImpl,
    });

    expect(meta.storageUrl).toBeNull();
    expect(meta.sourceUrl).toBe("https://cdn.example.com/thumb.webp");
  });
});

describe("course visual fallback", () => {
  it("prefers stored image over source", async () => {
    const { getCourseVisual } = await import("@/domain/course/course-visual");
    const visual = getCourseVisual({
      id: "1",
      title: "Long course title that should truncate in fallback visual area",
      imageStorageUrl: "https://cdn.example.com/stored.jpg",
      imageSourceUrl: "https://cdn.example.com/source.jpg",
      provider: { name: "Coursera", slug: "coursera" },
    } as never);
    expect(visual.type).toBe("image");
    if (visual.type === "image") {
      expect(visual.src).toBe("https://cdn.example.com/stored.jpg");
    }
  });

  it("uses provider fallback when image missing", async () => {
    const { getCourseVisual } = await import("@/domain/course/course-visual");
    const visual = getCourseVisual({
      id: "2",
      title: "Python for Everyone",
      imageStorageUrl: null,
      imageSourceUrl: null,
      provider: { name: "Coursera", slug: "coursera" },
    } as never);
    expect(visual.type).toBe("fallback");
    if (visual.type === "fallback") {
      expect(visual.eyebrow).toBe("Coursera");
    }
  });
});
