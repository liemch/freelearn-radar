import type { Db } from "@/db";
import {
  searchQueries,
  type NewSearchQuery,
  type SearchQuery,
} from "@/db/schema";
import { buildSearchLogFields } from "@/domain/search/normalize-query";
import { logger } from "@/lib/logger";

export type RecordSearchQueryInput = {
  rawQuery?: string | null;
  locale?: string | null;
  resultCount: number;
  latencyMs?: number | null;
  filtersJson?: Record<string, unknown> | null;
  retrievalMode?: NewSearchQuery["retrievalMode"];
  degraded?: boolean;
  topScore?: string | number | null;
  unmetIntent?: boolean;
  lexicalWouldBeZero?: boolean | null;
  rankingConfigVersion?: string | null;
  sessionHash?: string | null;
};

/**
 * Persist one public search request. Failures are logged and swallowed so
 * analytics never break the catalog page.
 */
export async function recordSearchQuery(
  db: Db,
  input: RecordSearchQueryInput,
): Promise<SearchQuery | null> {
  try {
    const fields = buildSearchLogFields(input.rawQuery);
    const zeroResult = input.resultCount <= 0;
    const unmetIntent = input.unmetIntent ?? zeroResult;
    const lexicalWouldBeZero =
      input.lexicalWouldBeZero ??
      (input.retrievalMode === undefined || input.retrievalMode === "LEXICAL"
        ? zeroResult
        : null);

    const rows = await db
      .insert(searchQueries)
      .values({
        queryHash: fields.queryHash,
        normalizedQuery: fields.normalizedQuery,
        locale: input.locale ?? null,
        queryLanguage: fields.queryLanguage,
        resultCount: input.resultCount,
        zeroResult,
        filtersJson: input.filtersJson ?? null,
        latencyMs: input.latencyMs ?? null,
        retrievalMode: input.retrievalMode ?? "LEXICAL",
        degraded: input.degraded ?? false,
        topScore:
          input.topScore === null || input.topScore === undefined
            ? null
            : String(input.topScore),
        unmetIntent,
        lexicalWouldBeZero,
        rankingConfigVersion: input.rankingConfigVersion ?? "lexical-v1",
        sessionHash: input.sessionHash ?? null,
      })
      .returning();

    return rows[0] ?? null;
  } catch (error) {
    logger.warn("search.record_query", {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}
