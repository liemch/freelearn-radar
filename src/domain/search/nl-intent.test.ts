import { beforeEach, describe, expect, it } from "vitest";

import {
  consumeNlIntentQuota,
  nlIntentSchema,
  parseIntentDeterministic,
  parseIntentWithOptionalAi,
  resetNlIntentQuota,
} from "@/domain/search/nl-intent";

describe("parseIntentDeterministic", () => {
  it("extracts topic, level, and duration from an English query", () => {
    const intent = parseIntentDeterministic(
      "python course for beginners under 5 hours",
    );
    expect(intent.topics).toContain("python");
    expect(intent.level).toBe("BEGINNER");
    expect(intent.maxDurationMinutes).toBe(300);
    expect(intent.rawQuery).toBe("python course for beginners under 5 hours");
  });

  it("detects certificate requirement", () => {
    expect(
      parseIntentDeterministic("free ai course with certificate")
        .certificateRequired,
    ).toBe(true);
    expect(
      parseIntentDeterministic("khóa học python có chứng chỉ")
        .certificateRequired,
    ).toBe(true);
    expect(
      parseIntentDeterministic("python basics").certificateRequired,
    ).toBeUndefined();
  });

  it("handles Vietnamese no-diacritic queries", () => {
    const intent = parseIntentDeterministic("khoa hoc lap trinh cho nguoi moi");
    expect(intent.topics).toContain("programming");
    expect(intent.level).toBe("BEGINNER");
  });

  it("detects language hints", () => {
    expect(parseIntentDeterministic("python tiếng việt").language).toBe("vi");
    expect(parseIntentDeterministic("python in english").language).toBe("en");
    expect(parseIntentDeterministic("python").language).toBeUndefined();
  });

  it("maps multi-word phrases before single tokens", () => {
    const intent = parseIntentDeterministic("machine learning fundamentals");
    expect(intent.topics).toEqual(["ai"]);
  });

  it("returns an empty-topic intent for unknown queries", () => {
    const intent = parseIntentDeterministic("underwater basket weaving");
    expect(intent.topics).toEqual([]);
    expect(intent.level).toBeUndefined();
    expect(nlIntentSchema.safeParse(intent).success).toBe(true);
  });
});

describe("nl intent quota", () => {
  beforeEach(() => {
    resetNlIntentQuota();
  });

  it("enforces the per-IP hourly limit", () => {
    const now = new Date("2026-08-14T10:00:00Z");
    for (let i = 0; i < 20; i += 1) {
      expect(consumeNlIntentQuota("1.2.3.4", now).allowed).toBe(true);
    }
    const blocked = consumeNlIntentQuota("1.2.3.4", now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("IP_HOURLY_LIMIT");
    expect(consumeNlIntentQuota("5.6.7.8", now).allowed).toBe(true);
  });

  it("resets the IP window after an hour", () => {
    const start = new Date("2026-08-14T10:00:00Z");
    for (let i = 0; i < 20; i += 1) {
      consumeNlIntentQuota("1.2.3.4", start);
    }
    expect(consumeNlIntentQuota("1.2.3.4", start).allowed).toBe(false);
    const later = new Date(start.getTime() + 61 * 60 * 1000);
    expect(consumeNlIntentQuota("1.2.3.4", later).allowed).toBe(true);
  });
});

describe("parseIntentWithOptionalAi", () => {
  beforeEach(() => {
    resetNlIntentQuota();
  });

  it("returns deterministic parse when the flag is off", async () => {
    const result = await parseIntentWithOptionalAi("python for beginners");
    expect(result.source).toBe("DETERMINISTIC");
    expect(result.rateLimited).toBe(false);
    expect(result.intent).toEqual(
      parseIntentDeterministic("python for beginners"),
    );
  });

  it("bounds very long queries instead of rejecting them", async () => {
    const long = `python ${"x".repeat(2000)}`;
    const result = await parseIntentWithOptionalAi(long);
    expect(result.intent.rawQuery.length).toBeLessThanOrEqual(512);
    expect(result.intent.topics).toContain("python");
  });
});
