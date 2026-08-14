import { describe, expect, it } from "vitest";

import { generateWatchToken } from "@/domain/alerts/watch-service";
import {
  freeDurabilityLabel,
  lastVerifiedFreshnessLabel,
  priceEventLabel,
  selectCourseBadgeSlots,
} from "@/domain/tracker/vocabulary";

describe("generateWatchToken", () => {
  it("returns a 64-char hex token", () => {
    const token = generateWatchToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(generateWatchToken()).not.toBe(token);
  });
});

describe("tracker vocabulary", () => {
  it("labels free durability in EN and VI", () => {
    expect(freeDurabilityLabel("PERMANENT", "en")).toBe("Usually free");
    expect(freeDurabilityLabel("LIMITED", "vi")).toBe("Miễn phí có thời hạn");
  });

  it("labels WENT_FREE events", () => {
    expect(priceEventLabel("WENT_FREE", "en")).toBe("Just went free");
    expect(priceEventLabel("WENT_FREE", "vi")).toBe("Vừa miễn phí");
  });

  it("describes verification freshness", () => {
    const now = new Date("2026-08-14T12:00:00Z");
    expect(lastVerifiedFreshnessLabel(null, "en", now)).toBe("Not checked yet");
    expect(
      lastVerifiedFreshnessLabel(new Date("2026-08-14T10:00:00Z"), "en", now),
    ).toBe("Checked today");
    expect(
      lastVerifiedFreshnessLabel(new Date("2026-07-01T10:00:00Z"), "vi", now),
    ).toBe("Có thể đã cũ");
  });

  it("keeps badge count ≤ 3 and skips UNKNOWN durability", () => {
    expect(
      selectCourseBadgeSlots({
        certificateKnown: true,
        freeDurability: "PERMANENT",
      }),
    ).toEqual(["price", "certificate", "durability"]);

    expect(
      selectCourseBadgeSlots({
        certificateKnown: true,
        freeDurability: "UNKNOWN",
      }),
    ).toEqual(["price", "certificate"]);

    expect(
      selectCourseBadgeSlots({
        certificateKnown: false,
        freeDurability: "LIMITED",
      }),
    ).toEqual(["price", "durability"]);
  });
});
