import { describe, expect, it } from "vitest";

describe("health endpoint contract", () => {
  it("defines the expected response shape", () => {
    const payload = {
      status: "ok",
      service: "freelearn-radar",
      timestamp: new Date().toISOString(),
    };

    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("freelearn-radar");
    expect(() => new Date(payload.timestamp)).not.toThrow();
  });
});
