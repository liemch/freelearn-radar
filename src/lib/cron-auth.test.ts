import { describe, expect, it } from "vitest";

import { verifyCronAuth } from "@/lib/cron-auth";

describe("verifyCronAuth", () => {
  it("requires configured secret and matching header", () => {
    expect(verifyCronAuth(new Headers(), undefined)).toBe(false);
    expect(
      verifyCronAuth(new Headers({ authorization: "Bearer abc" }), "abc"),
    ).toBe(true);
    expect(
      verifyCronAuth(new Headers({ authorization: "Bearer wrong" }), "abc"),
    ).toBe(false);
  });
});
