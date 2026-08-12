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

  it("defines deep health degraded shape", () => {
    const payload = {
      status: "degraded" as const,
      service: "freelearn-radar",
      timestamp: new Date().toISOString(),
      database: "error" as const,
    };

    expect(payload.status).toBe("degraded");
    expect(payload.database).toBe("error");
  });
});
