import type { Db } from "@/db";
import { bumpDiscoveryCategoryStats } from "@/db/repositories/coupon-repository";
import { measureApiUsage } from "@/domain/admin/api-usage";
import { ingestSearchResult } from "@/domain/candidate/candidate-service";
import {
  listDueDiscoveryQueries,
  markDiscoveryQueryFailure,
  markDiscoveryQuerySuccess,
} from "@/domain/discovery/discovery-query-service";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { SearchProvider } from "@/services/search/search-provider";

export type DiscoveryRunSummary = {
  queriesProcessed: number;
  created: number;
  duplicates: number;
  invalid: number;
  errors: number;
};

function inferDomain(providerSlug: string): string | undefined {
  const map: Record<string, string> = {
    coursera: "coursera.org",
    udemy: "udemy.com",
    edx: "edx.org",
    "microsoft-learn": "learn.microsoft.com",
    freecodecamp: "freecodecamp.org",
    aws: "aws.amazon.com",
    google: "developers.google.com",
    "linkedin-learning": "linkedin.com",
    "hubspot-academy": "academy.hubspot.com",
    "ibm-skillsbuild": "skillsbuild.org",
    "salesforce-trailhead": "trailhead.salesforce.com",
    "kaggle-learn": "kaggle.com",
  };

  return map[providerSlug];
}

export async function runDiscoveryBatch(
  db: Db,
  searchProvider: SearchProvider,
  options?: {
    queryLimit?: number;
    resultLimit?: number;
    /** Optional admin scoping (project plan §31): restrict the run to one provider/topic. */
    provider?: string;
    category?: string;
    /** Manual admin runs may bypass the per-query 24h cooldown. */
    ignoreSchedule?: boolean;
  },
): Promise<DiscoveryRunSummary> {
  const env = getServerEnv();
  const queryLimit = options?.queryLimit ?? env.DISCOVERY_QUERY_LIMIT;
  const resultLimit = options?.resultLimit ?? env.DISCOVERY_RESULT_LIMIT;

  const queries = await listDueDiscoveryQueries(db, queryLimit, {
    provider: options?.provider,
    category: options?.category,
    ignoreSchedule: options?.ignoreSchedule,
  });
  const summary: DiscoveryRunSummary = {
    queriesProcessed: 0,
    created: 0,
    duplicates: 0,
    invalid: 0,
    errors: 0,
  };

  for (const query of queries) {
    summary.queriesProcessed += 1;
    const domain = inferDomain(query.provider);
      let createdForQuery = 0;
      let duplicateForQuery = 0;
      let invalidForQuery = 0;

      try {
      const results = await measureApiUsage(
        db,
        {
          kind: "search",
          provider: "tavily",
          operation: "discovery_search",
          domain: domain ?? null,
          meta: { discoveryQueryId: query.id, maxResults: resultLimit },
        },
        () =>
          searchProvider.search({
            query: query.query,
            maxResults: resultLimit,
            includeDomains: domain ? [domain] : undefined,
          }),
        (found) => ({ meta: { resultCount: found.length } }),
      );

      for (const result of results) {
        const outcome = await ingestSearchResult(db, {
          result,
          searchQuery: query.query,
          providerHint: query.provider,
          discoveryQueryId: query.id,
        });

        if (outcome.status === "CREATED") {
          summary.created += 1;
          createdForQuery += 1;
        } else if (outcome.status === "DUPLICATE") {
          summary.duplicates += 1;
          duplicateForQuery += 1;
        } else {
          summary.invalid += 1;
          invalidForQuery += 1;
        }
      }

      const resultCount = results.length;
      const junkRate =
        resultCount > 0
          ? (duplicateForQuery + invalidForQuery) / resultCount
          : 1;

      await markDiscoveryQuerySuccess(db, query.id, { junkRate });

      if (query.category) {
        await bumpDiscoveryCategoryStats(db, query.category, {
          queriesRun: 1,
          candidatesFound: createdForQuery,
          zeroCandidateRuns: createdForQuery === 0 ? 1 : 0,
          lastDiscoveredAt: createdForQuery > 0 ? new Date() : undefined,
        });
      }
    } catch (error) {
      summary.errors += 1;
      await markDiscoveryQueryFailure(db, query.id);
      logger.error("discovery.batch.query", {
        status: "error",
        queryId: query.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  logger.info("discovery.batch", { status: "success", ...summary });
  return summary;
}
