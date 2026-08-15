import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("M22.0 UI refresh wiring", () => {
  it("registers the branding migration in the drizzle journal", () => {
    const journal = read("drizzle/meta/_journal.json");
    expect(journal).toContain("0014_m22_site_branding");
    expect(read("drizzle/0014_m22_site_branding.sql")).toContain(
      "site_settings",
    );
    expect(read("drizzle/0014_m22_site_branding.sql")).toContain("site_assets");
  });

  it("exposes Admin branding under Cấu hình giao diện", () => {
    const shell = read("src/components/admin/admin-shell.tsx");
    expect(shell).toContain("/admin/branding");
    expect(shell).toContain("t.nav.branding");
    expect(read("src/app/admin/branding/page.tsx")).toContain("BrandingEditForm");
  });

  it("serves branding assets through a public API route", () => {
    expect(read("src/app/api/site-assets/[key]/route.ts")).toContain(
      "getSiteAsset",
    );
    expect(read("src/app/api/admin/branding/route.ts")).toContain(
      "SITE_BRANDING",
    );
  });

  it("resolves header logo from branding with BrandMark fallback", () => {
    const header = read("src/components/public/site-header.tsx");
    expect(header).toContain("resolveBranding");
    expect(header).toContain("BrandLogo");
  });

  it("does not invent partner language for provider logos", () => {
    const home = read("src/app/[locale]/page.tsx");
    expect(home).toContain("providersOnRadar");
    expect(home).not.toMatch(/đối tác uy tín/i);
    expect(home).not.toMatch(/trusted partners/i);
  });

  it("does not render blog routes (out of scope)", () => {
    expect(() => read("src/app/[locale]/blog/page.tsx")).toThrow();
  });
});
