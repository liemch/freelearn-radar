/**
 * Map free-text ingest / candidate errors onto a stable ops taxonomy.
 * Prefer existing strings; do not invent a second overlapping system.
 */
export type DiscoveryFailureReason =
  | "DUPLICATE"
  | "INVALID_URL"
  | "NO_COURSE_SIGNAL"
  | "FETCH_FAILED"
  | "TRUTH_FAILED"
  | "NOT_FREE"
  | "MISSING_REQUIRED_METADATA"
  | "BLOCKED_BY_PROVIDER_POLICY"
  | "UNSUPPORTED_PROVIDER"
  | "AUTO_REJECT"
  | "EXPIRED_UNREVIEWED"
  | "OTHER";

export function classifyDiscoveryFailureReason(
  error: string | null | undefined,
  status?: string | null,
): DiscoveryFailureReason {
  if (status === "DUPLICATE") return "DUPLICATE";
  if (status === "EXPIRED_UNREVIEWED") return "EXPIRED_UNREVIEWED";

  const text = (error ?? "").toUpperCase();
  if (!text) return "OTHER";

  if (text.includes("DUPLICATE") || text.includes("ALREADY EXISTS")) {
    return "DUPLICATE";
  }
  if (
    text.includes("INVALID EXTERNAL URL") ||
    text.includes("URL NORMALIZE") ||
    text.includes("INVALID_URL")
  ) {
    return "INVALID_URL";
  }
  if (
    text.includes("NON_COURSE_PATTERN") ||
    text.includes("NO_COURSE") ||
    text.includes("NOT_A_COURSE")
  ) {
    return "NO_COURSE_SIGNAL";
  }
  if (
    text.includes("FETCH") ||
    text.includes("TIMEOUT") ||
    text.includes("HTTP")
  ) {
    return "FETCH_FAILED";
  }
  if (text.includes("AUTO_REJECT")) return "AUTO_REJECT";
  if (text.includes("PROVIDER_POLICY") || text.includes("POLICY")) {
    return "BLOCKED_BY_PROVIDER_POLICY";
  }
  if (text.includes("NOT_FREE") || text.includes("PRICE")) return "NOT_FREE";
  if (text.includes("TRUTH") || text.includes("VERIF")) return "TRUTH_FAILED";
  if (text.includes("MISSING") || text.includes("REQUIRED")) {
    return "MISSING_REQUIRED_METADATA";
  }
  if (text.includes("UNSUPPORTED")) return "UNSUPPORTED_PROVIDER";

  return "OTHER";
}
