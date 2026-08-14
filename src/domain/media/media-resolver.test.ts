import { describe, expect, it } from "vitest";

import {
  resolveMediaStatus,
  summarizeMediaQuality,
} from "@/domain/media/media-resolver";
import { validateImageUrl } from "@/services/images/course-image-service";

describe("media resolver SSRF / fallback", () => {
  it("blocks private hosts", () => {
    expect(validateImageUrl("https://127.0.0.1/x.png")).toBeNull();
    expect(validateImageUrl("https://169.254.169.254/latest")).toBeNull();
    expect(validateImageUrl("https://192.168.1.1/img.png")).toBeNull();
  });

  it("falls back when source missing — course still renderable", () => {
    const result = resolveMediaStatus({
      sourceUrl: null,
      storageUrl: null,
      fetchResult: null,
      providerSlug: "udemy",
      categorySlug: "personal-development",
    });
    expect(result.imageStatus).toBe("FALLBACK");
    expect(result.imageSourceType).toBe("CATEGORY_FALLBACK");
    expect(result.imageResolvedUrl).toBeNull();
  });

  it("marks broken fetch without inventing official image", () => {
    const result = resolveMediaStatus({
      sourceUrl: "https://img.example.com/a.jpg",
      storageUrl: null,
      fetchResult: { ok: false, reason: "http_404" },
      providerSlug: "coursera",
    });
    expect(result.imageStatus).toBe("BROKEN");
    expect(result.imageSourceType).toBe("PROVIDER_FALLBACK");
  });

  it("accepts successful official fetch", () => {
    const result = resolveMediaStatus({
      sourceUrl: "https://img.udemy.com/course/480x270/1.jpg",
      storageUrl: null,
      fetchResult: {
        ok: true,
        contentType: "image/jpeg",
        bytes: new Uint8Array([1, 2, 3]),
        finalUrl: "https://img.udemy.com/course/480x270/1.jpg",
      },
      width: 480,
      height: 270,
    });
    expect(result.imageStatus).toBe("OK");
    expect(result.imageSourceType).toBe("OFFICIAL");
  });
});

describe("summarizeMediaQuality", () => {
  it("aggregates admin metrics", () => {
    const summary = summarizeMediaQuality([
      { imageStatus: "OK", imageSourceType: "OFFICIAL" },
      { imageStatus: "FALLBACK", imageSourceType: "CATEGORY_FALLBACK" },
      { imageStatus: "BROKEN", imageSourceType: "PROVIDER_FALLBACK" },
      { imageStatus: "MISSING", imageSourceType: "NONE" },
    ]);
    expect(summary.total).toBe(4);
    expect(summary.withThumbnail).toBe(1);
    expect(summary.fallback).toBe(1);
    expect(summary.broken).toBe(1);
    expect(summary.missing).toBe(1);
  });
});
