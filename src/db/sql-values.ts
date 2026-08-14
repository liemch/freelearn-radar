/**
 * Coercions for values that come back from raw `sql` expressions.
 *
 * Drizzle maps column selects to JS types, but a raw `sql` fragment is opaque
 * to it: the `sql<Date | null>` annotation is an assertion the compiler
 * believes and the driver never honours. `max(timestamptz)` arrives as a
 * string, so calling `.getTime()` on it typechecks, builds, and then throws on
 * the first request that actually has data.
 *
 * Anything read through a raw aggregate goes through here.
 */
export function toDateOrNull(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/** Same problem for numeric aggregates, which can arrive as strings. */
export function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
