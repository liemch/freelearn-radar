import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A signed cookie stays valid until it expires, so deleting or demoting a user
 * used to leave their console access intact. These cover the database-backed
 * checks that close that window — including the deliberate fallback when the
 * database itself is unreachable.
 */

const cookieValue = { current: undefined as string | undefined };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "flr_session" && cookieValue.current
        ? { name, value: cookieValue.current }
        : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

const findUserById = vi.fn();

vi.mock("@/db/repositories/user-repository", () => ({
  findUserById: (...args: unknown[]) => findUserById(...args),
}));

const getDb = vi.fn(() => ({}) as never);

vi.mock("@/db", () => ({
  getDb: () => getDb(),
}));

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/test";
process.env.AUTH_SECRET = "session-revocation-test-secret-over-32-characters";
process.env.APP_URL = "http://localhost:3000";

const USER_ID = "00000000-0000-0000-0000-000000000001";

async function signIn(sessionVersion?: number) {
  const { resetServerEnvCache } = await import("@/lib/env");
  resetServerEnvCache();
  const { createSessionToken } = await import("@/lib/auth/session");
  cookieValue.current = await createSessionToken({
    userId: USER_ID,
    email: "admin@example.com",
    role: "ADMIN",
    sessionVersion,
  });
}

function storedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: "admin@example.com",
    name: "Admin",
    role: "ADMIN",
    sessionVersion: 1,
    ...overrides,
  };
}

beforeEach(() => {
  cookieValue.current = undefined;
  findUserById.mockReset();
  getDb.mockClear();
});

describe("getSession revocation checks", () => {
  it("accepts a session whose version still matches the user row", async () => {
    await signIn(1);
    findUserById.mockResolvedValue(storedUser());

    const { getSession } = await import("@/lib/auth/guards");
    const session = await getSession();

    expect(session).toMatchObject({ userId: USER_ID, role: "ADMIN" });
  });

  it("rejects a session after the user row is deleted", async () => {
    await signIn(1);
    findUserById.mockResolvedValue(null);

    const { getSession } = await import("@/lib/auth/guards");

    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects a session minted before sessions were revoked", async () => {
    await signIn(1);
    findUserById.mockResolvedValue(storedUser({ sessionVersion: 2 }));

    const { getSession } = await import("@/lib/auth/guards");

    await expect(getSession()).resolves.toBeNull();
  });

  it("uses the stored role, so a demotion does not wait for re-login", async () => {
    await signIn(1);
    findUserById.mockResolvedValue(storedUser({ role: "EDITOR" }));

    const { getSession } = await import("@/lib/auth/guards");
    const session = await getSession();

    expect(session?.role).toBe("EDITOR");
  });

  it("treats a token minted before the claim existed as version 1", async () => {
    await signIn(undefined);
    findUserById.mockResolvedValue(storedUser());

    const { getSession } = await import("@/lib/auth/guards");

    await expect(getSession()).resolves.not.toBeNull();
  });

  it("keeps the token when the database cannot answer", async () => {
    await signIn(1);
    findUserById.mockRejectedValue(new Error("connection refused"));

    const { getSession } = await import("@/lib/auth/guards");
    const session = await getSession();

    expect(session?.userId).toBe(USER_ID);
  });
});
