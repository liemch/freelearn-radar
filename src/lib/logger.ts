type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function writeLog(level: LogLevel, operation: string, payload: LogPayload = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    operation,
    ...payload,
  };

  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

export const logger = {
  info(operation: string, payload?: LogPayload) {
    writeLog("info", operation, payload);
  },
  warn(operation: string, payload?: LogPayload) {
    writeLog("warn", operation, payload);
  },
  error(operation: string, payload?: LogPayload) {
    writeLog("error", operation, payload);
  },
};
