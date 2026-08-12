import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password auth", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("secure-password-123");
    expect(hash).not.toBe("secure-password-123");
    await expect(verifyPassword("secure-password-123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
