import { describe, expect, it } from "vitest";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifyCronAuth } from "@/lib/cron-auth";

describe("authorization contracts", () => {
  it("rejects cron requests without a secret", () => {
    expect(verifyCronAuth(new Headers(), "")).toBe(false);
    expect(verifyCronAuth(new Headers(), "secret")).toBe(false);
  });

  it("accepts bearer or x-cron-secret", () => {
    expect(
      verifyCronAuth(
        new Headers({ authorization: "Bearer cron-secret" }),
        "cron-secret",
      ),
    ).toBe(true);
    expect(
      verifyCronAuth(
        new Headers({ "x-cron-secret": "cron-secret" }),
        "cron-secret",
      ),
    ).toBe(true);
  });

  it("keeps admin session cookie http-only name stable", () => {
    expect(SESSION_COOKIE_NAME).toBe("flr_session");
  });
});

describe("secret exposure guards", () => {
  it("does not put secrets in public env prefix", () => {
    const publicKeys = Object.keys(process.env).filter((key) =>
      key.startsWith("NEXT_PUBLIC_"),
    );

    for (const key of publicKeys) {
      expect(key).not.toMatch(/API_KEY|SECRET|DATABASE_URL|PASSWORD/i);
    }
  });
});
