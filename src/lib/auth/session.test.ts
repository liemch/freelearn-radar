import { beforeEach, describe, expect, it } from "vitest";

import { resetServerEnvCache } from "@/lib/env";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth/session";

const TEST_SECRET =
  "test-auth-secret-with-more-than-thirty-two-characters";

describe("session tokens", () => {
  beforeEach(() => {
    resetServerEnvCache();
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.DATABASE_URL =
      "postgresql://user:password@localhost:5432/freelearn_radar_test";
  });

  it("creates and verifies a signed session token", async () => {
    const token = await createSessionToken({
      userId: "user-123",
      email: "admin@example.com",
      role: "ADMIN",
    });

    const session = await verifySessionToken(token);

    expect(session).toEqual({
      userId: "user-123",
      email: "admin@example.com",
      role: "ADMIN",
      sessionVersion: 1,
    });
  });

  it("round-trips the session version used for revocation", async () => {
    const token = await createSessionToken({
      userId: "user-123",
      email: "admin@example.com",
      role: "ADMIN",
      sessionVersion: 4,
    });

    const session = await verifySessionToken(token);

    expect(session?.sessionVersion).toBe(4);
  });

  it("rejects tampered tokens", async () => {
    const session = await verifySessionToken("invalid.token.value");
    expect(session).toBeNull();
  });
});
