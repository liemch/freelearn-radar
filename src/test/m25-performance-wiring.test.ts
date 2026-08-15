import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("M25 performance / UX wiring", () => {
  it("dedupes public branding through getResolvedBranding", () => {
    expect(read("src/domain/branding/get-resolved-branding.ts")).toContain(
      "unstable_cache",
    );
    expect(read("src/components/public/site-header.tsx")).toContain(
      "getResolvedBranding",
    );
    expect(read("src/app/layout.tsx")).toContain("getResolvedBranding");
    expect(read("src/app/[locale]/page.tsx")).toContain("getResolvedBranding");
    expect(read("src/app/[locale]/page.tsx")).not.toContain("home.freeCert");
    expect(read("src/app/[locale]/page.tsx")).not.toContain("home.short");
  });

  it("busts branding cache tag on Admin revalidation", () => {
    const revalidate = read("src/domain/branding/revalidate-public.ts");
    expect(revalidate).toContain("SITE_BRANDING_CACHE_TAG");
    expect(revalidate).toContain("revalidateTag");
  });

  it("loads fonts via next/font instead of render-blocking Google CSS", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('from "next/font/google"');
    expect(layout).not.toContain("fonts.googleapis.com/css2");
  });

  it("provides route-shaped loading UI for home and daily free", () => {
    expect(read("src/app/[locale]/loading.tsx")).toContain('variant="home"');
    expect(
      read("src/app/[locale]/mien-phi-hom-nay/loading.tsx"),
    ).toContain('variant="catalog"');
    expect(read("src/components/public/public-page-loading.tsx")).toContain(
      "HomeSkeleton",
    );
  });
});
