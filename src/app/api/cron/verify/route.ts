import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  createStaticEvidenceProvider,
  runVerificationBatch,
} from "@/domain/verification/verify-batch";
import type { VerificationEvidenceInput } from "@/domain/verification/verification-service";
import { createSearchProvider } from "@/services/search/tavily-search-provider";

/** Re-verifies a batch of courses against the search provider. */
export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Evidence gatherer: uses SearchProvider snippet when Tavily is configured;
 * otherwise marks verification failed-closed without inventing free status.
 */
function createLiveEvidenceProvider(hasSearchKey: boolean) {
  if (!hasSearchKey) {
    return createStaticEvidenceProvider({});
  }

  const search = createSearchProvider();
  return {
    async gather(course: {
      id: string;
      title: string;
      canonicalUrl: string;
    }): Promise<VerificationEvidenceInput> {
      try {
        const results = await search.search({
          query: `${course.title} site:${new URL(course.canonicalUrl).hostname}`,
          maxResults: 2,
          includeDomains: [new URL(course.canonicalUrl).hostname],
          timeoutMs: 8_000,
        });
        const text = results
          .map((item) => `${item.title}\n${item.content}`)
          .join("\n");
        return {
          text: text || course.title,
          sourceUrl: results[0]?.url ?? course.canonicalUrl,
          method: "SEARCH",
          availability: results.length > 0 ? "AVAILABLE" : "UNKNOWN",
        };
      } catch {
        return {
          text: "",
          sourceUrl: course.canonicalUrl,
          method: "SEARCH",
          availability: "UNKNOWN",
        };
      }
    },
  };
}

export async function GET(request: Request) {
  const env = getServerEnv();
  if (!verifyCronAuth(request.headers, env.CRON_SECRET)) {
    return unauthorized();
  }

  try {
    const db = getDb();
    const provider = createLiveEvidenceProvider(Boolean(env.TAVILY_API_KEY));
    const summary = await runVerificationBatch(db, provider, {
      limit: env.MAX_VERIFICATIONS_PER_RUN,
    });

    logger.info("cron.verify", { status: "success", ...summary });

    return NextResponse.json({
      ok: true,
      verification: summary,
      pendingManualIntegrationTest: !env.TAVILY_API_KEY,
    });
  } catch (error) {
    logger.error("cron.verify", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Verification cron failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
