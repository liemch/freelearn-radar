import { customType } from "drizzle-orm/pg-core";

/**
 * pgvector column. Stored as a float array in TypeScript; serialized as
 * `[1,2,3]` for the driver. Dimension is fixed by migration (1024 for M20.2).
 */
export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1024})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value.map(Number);
    }
    if (typeof value === "string") {
      const trimmed = value.replace(/^\[/, "").replace(/\]$/, "");
      if (!trimmed) return [];
      return trimmed.split(",").map((part) => Number(part.trim()));
    }
    return [];
  },
});
