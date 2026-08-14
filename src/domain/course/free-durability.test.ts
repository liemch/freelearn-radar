import { describe, expect, it } from "vitest";

import {
  assertVisibleOnPublicCatalog,
  deriveFreeDurability,
  isEligibleForFreeLists,
  PublicCatalogVisibilityError,
} from "@/domain/course/free-durability";
import type { PriceType } from "@/domain/course/types";

describe("deriveFreeDurability", () => {
  it.each([
    ["microsoft-learn", "FREE_FULL", "PERMANENT"],
    ["freecodecamp", "FREE_FULL", "PERMANENT"],
    ["aws", "FREE_FULL", "PERMANENT"],
    ["google", "FREE_FULL", "PERMANENT"],
    ["coursera", "FREE_AUDIT", "AUDIT_FOREVER"],
    ["edx", "FREE_AUDIT", "AUDIT_FOREVER"],
  ] as const)("%s + %s → %s", (slug, price, expected) => {
    expect(deriveFreeDurability(slug, price)).toBe(expected);
  });

  it.each([
    "FREE_WITH_COUPON",
    "TEMPORARILY_FREE",
    "FREE_TRIAL",
  ] as const)("%s → LIMITED regardless of provider", (price) => {
    expect(deriveFreeDurability("udemy", price)).toBe("LIMITED");
    expect(deriveFreeDurability("coursera", price)).toBe("LIMITED");
  });

  it("returns UNKNOWN for unmatched combinations", () => {
    expect(deriveFreeDurability("udemy", "FREE_FULL")).toBe("UNKNOWN");
    expect(deriveFreeDurability("coursera", "FREE_FULL")).toBe("UNKNOWN");
    expect(deriveFreeDurability("microsoft-learn", "FREE_AUDIT")).toBe(
      "UNKNOWN",
    );
    expect(deriveFreeDurability(null, "FREE_FULL")).toBe("UNKNOWN");
    expect(deriveFreeDurability("linkedin-learning", "PAID")).toBe("UNKNOWN");
  });
});

describe("isEligibleForFreeLists", () => {
  it.each([
    ["FREE_FULL", true],
    ["FREE_AUDIT", true],
    ["FREE_WITH_COUPON", true],
    ["TEMPORARILY_FREE", true],
    ["UNKNOWN", true],
    ["FREE_TRIAL", false],
    ["FREE_PREVIEW", false],
    ["PAID", false],
  ] as const)("%s → %s", (price: PriceType, expected) => {
    expect(isEligibleForFreeLists(price)).toBe(expected);
  });
});

describe("assertVisibleOnPublicCatalog", () => {
  it("allows free-labelled price types", () => {
    expect(() => assertVisibleOnPublicCatalog("FREE_FULL")).not.toThrow();
    expect(() => assertVisibleOnPublicCatalog("FREE_AUDIT")).not.toThrow();
  });

  it("rejects PAID, FREE_TRIAL, and FREE_PREVIEW", () => {
    expect(() => assertVisibleOnPublicCatalog("PAID")).toThrow(
      PublicCatalogVisibilityError,
    );
    expect(() => assertVisibleOnPublicCatalog("FREE_TRIAL")).toThrow(
      PublicCatalogVisibilityError,
    );
    expect(() => assertVisibleOnPublicCatalog("FREE_PREVIEW")).toThrow(
      PublicCatalogVisibilityError,
    );
  });
});
