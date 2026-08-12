import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("normalizes names into URL slugs", () => {
    expect(slugify("Artificial Intelligence")).toBe("artificial-intelligence");
    expect(slugify("  Microsoft Learn ")).toBe("microsoft-learn");
  });
});
