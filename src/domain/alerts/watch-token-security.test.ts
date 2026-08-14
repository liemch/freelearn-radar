import { beforeAll, describe, expect, it } from "vitest";

import {
  CONFIRM_TOKEN_TTL_MS,
  deriveUnsubscribeToken,
  generateWatchToken,
  hashWatchToken,
  isConfirmTokenExpired,
  verifyUnsubscribeToken,
} from "@/domain/alerts/watch-token";

beforeAll(() => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/test";
});

// SEC-02: a database read used to yield working confirmation links.
describe("confirm token storage", () => {
  it("stores a digest that does not reveal the token", () => {
    const token = generateWatchToken();
    const stored = hashWatchToken(token);

    expect(stored).not.toBe(token);
    expect(stored).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes deterministically so lookup by digest works", () => {
    const token = generateWatchToken();
    expect(hashWatchToken(token)).toBe(hashWatchToken(token));
  });

  it("ignores surrounding whitespace from a copied link", () => {
    const token = generateWatchToken();
    expect(hashWatchToken(`  ${token} `)).toBe(hashWatchToken(token));
  });

  it("separates distinct tokens", () => {
    expect(hashWatchToken(generateWatchToken())).not.toBe(
      hashWatchToken(generateWatchToken()),
    );
  });
});

describe("confirm token expiry", () => {
  const issued = new Date("2026-08-01T00:00:00Z");

  it("accepts a token inside the window", () => {
    expect(
      isConfirmTokenExpired(issued, new Date(issued.getTime() + 1_000)),
    ).toBe(false);
  });

  it("rejects a token past the window", () => {
    expect(
      isConfirmTokenExpired(
        issued,
        new Date(issued.getTime() + CONFIRM_TOKEN_TTL_MS + 1_000),
      ),
    ).toBe(true);
  });
});

// Derived rather than stored: the link must survive in every future alert email
// while leaving no credential in the database.
describe("unsubscribe token derivation", () => {
  const watchId = "0f1d2c3b-4a59-4687-9c12-abcdefabcdef";

  it("derives the same token for the same watch", () => {
    expect(deriveUnsubscribeToken(watchId)).toBe(
      deriveUnsubscribeToken(watchId),
    );
  });

  it("derives different tokens for different watches", () => {
    expect(deriveUnsubscribeToken(watchId)).not.toBe(
      deriveUnsubscribeToken("11111111-2222-3333-4444-555555555555"),
    );
  });

  it("verifies its own token", () => {
    expect(verifyUnsubscribeToken(watchId, deriveUnsubscribeToken(watchId))).toBe(
      true,
    );
  });

  it("rejects another watch's token", () => {
    const other = deriveUnsubscribeToken(
      "11111111-2222-3333-4444-555555555555",
    );
    expect(verifyUnsubscribeToken(watchId, other)).toBe(false);
  });

  it("rejects a malformed token without throwing on length mismatch", () => {
    expect(verifyUnsubscribeToken(watchId, "short")).toBe(false);
    expect(verifyUnsubscribeToken(watchId, "")).toBe(false);
  });
});
