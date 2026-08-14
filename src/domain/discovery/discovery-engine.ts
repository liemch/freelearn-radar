import type { Db } from "@/db";
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

    try {
      const results = await searchProvider.search({
        query: query.query,
        maxResults: resultLimit,
        includeDomains: domain ? [domain] : undefined,
      });

      for (const result of results) {
        const outcome = await ingestSearchResult(db, {
          result,
          searchQuery: query.query,
          providerHint: query.provider,
        });

        if (outcome.status === "CREATED") {
          summary.created += 1;
        } else if (outcome.status === "DUPLICATE") {
          summary.duplicates += 1;
        } else {
          summary.invalid += 1;
        }
      }

      await markDiscoveryQuerySuccess(db, query.id);
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
