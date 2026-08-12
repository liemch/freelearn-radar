import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges tailwind class names", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
