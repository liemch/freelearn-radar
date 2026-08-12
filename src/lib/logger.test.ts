import { describe, expect, it } from "vitest";

import { logger } from "@/lib/logger";

describe("logger", () => {
  it("emits structured JSON logs", () => {
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (message?: unknown) => {
      logs.push(String(message));
    };

    try {
      logger.info("health.check", { status: "ok" });
    } finally {
      console.log = originalLog;
    }

    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(logs[0]!) as {
      operation: string;
      status: string;
      timestamp: string;
    };

    expect(parsed.operation).toBe("health.check");
    expect(parsed.status).toBe("ok");
    expect(parsed.timestamp).toBeTruthy();
  });
});
