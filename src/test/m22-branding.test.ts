import { describe, expect, it } from "vitest";

import {
  BRANDING_MAX_BYTES,
  defaultHeroCopy,
  resolveHeroCopy,
  validateBrandingUpload,
} from "@/domain/branding/site-branding";
import type { SiteSettings } from "@/db/schema/site-branding";

describe("M22.0 site branding", () => {
  it("falls back to dictionary hero copy when settings are empty", () => {
    const resolved = resolveHeroCopy(null);
    const defaults = defaultHeroCopy();
    expect(resolved.title).toBe(defaults.title);
    expect(resolved.eyebrow).toBe(defaults.eyebrow);
    expect(resolved.searchPlaceholder).toBe(defaults.searchPlaceholder);
  });

  it("prefers Admin overrides over dictionary defaults", () => {
    const settings = {
      id: "default",
      heroEyebrow: "  Tuyển chọn  ",
      heroTitle: "Học gì hôm nay?",
      heroDescription: "Mô tả tùy chỉnh",
      searchPlaceholder: "Tìm AI…",
      heroImageAlt: "Banner",
      logoAssetKey: null,
      logoCompactAssetKey: null,
      faviconAssetKey: null,
      heroAssetKey: null,
      logoManagedAssetId: null,
      logoCompactManagedAssetId: null,
      faviconManagedAssetId: null,
      heroManagedAssetId: null,
      updatedAt: new Date(),
    } satisfies SiteSettings;

    const resolved = resolveHeroCopy(settings);
    expect(resolved.eyebrow).toBe("Tuyển chọn");
    expect(resolved.title).toBe("Học gì hôm nay?");
    expect(resolved.description).toBe("Mô tả tùy chỉnh");
    expect(resolved.searchPlaceholder).toBe("Tìm AI…");
    expect(resolved.heroImageAlt).toBe("Banner");
  });

  it("rejects unsupported MIME and oversize uploads", () => {
    expect(
      validateBrandingUpload({
        key: "logo",
        contentType: "image/svg+xml",
        byteLength: 100,
      }).ok,
    ).toBe(false);

    expect(
      validateBrandingUpload({
        key: "logo",
        contentType: "image/png",
        byteLength: BRANDING_MAX_BYTES.logo + 1,
      }).ok,
    ).toBe(false);

    expect(
      validateBrandingUpload({
        key: "logo",
        contentType: "image/png",
        byteLength: 1024,
      }),
    ).toEqual({ ok: true });
  });

  it("restricts ICO to favicon slot", () => {
    expect(
      validateBrandingUpload({
        key: "hero",
        contentType: "image/x-icon",
        byteLength: 1024,
      }).ok,
    ).toBe(false);

    expect(
      validateBrandingUpload({
        key: "favicon",
        contentType: "image/x-icon",
        byteLength: 1024,
      }),
    ).toEqual({ ok: true });
  });
});
