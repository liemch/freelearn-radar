import { desc } from "drizzle-orm";

import type { Db } from "@/db";
import {
  searchBenchmarkRuns,
  type NewSearchBenchmarkRun,
  type SearchBenchmarkRun,
} from "@/db/schema";
import { queryCatalog } from "@/db/repositories/course-repository";
import { LEXICAL_RANKING_CONFIG_VERSION } from "@/domain/search/lexical";
import {
  defaultSearchEvalPath,
  loadSearchEvalDataset,
  type SearchEvalDataset,
} from "@/domain/search/eval-dataset";

export type LexicalBenchmarkSummary = {
  datasetVersion: string;
  retrievalMode: "LEXICAL";
  rankingConfigVersion: string;
  queryCount: number;
  labeledQueryCount: number;
  zeroResultCount: number;
  zeroResultRate: number;
  exactTitleHitRate: number | null;
  latencyP95Ms: number | null;
  meanResultCount: number;
  ndcgAt10: number | null;
  precisionAt5: number | null;
  note: string;
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx] ?? null;
}

function dcg(grades: number[]): number {
  return grades.reduce((sum, grade, index) => {
    const denom = Math.log2(index + 2);
    return sum + ((2 ** grade - 1) / denom);
  }, 0);
}

function ndcgAtK(
  retrievedIds: string[],
  labels: Record<string, number>,
  k: number,
): number | null {
  const gains = retrievedIds
    .slice(0, k)
    .map((id) => labels[id] ?? 0);
  if (Object.keys(labels).length === 0) return null;
  const ideal = Object.values(labels)
    .sort((a, b) => b - a)
    .slice(0, k);
  const idealDcg = dcg(ideal);
  if (idealDcg <= 0) return null;
  return dcg(gains) / idealDcg;
}

function precisionAtK(
  retrievedIds: string[],
  labels: Record<string, number>,
  k: number,
  relevantMin = 2,
): number | null {
  if (Object.keys(labels).length === 0) return null;
  const slice = retrievedIds.slice(0, k);
  if (slice.length === 0) return 0;
  const hits = slice.filter((id) => (labels[id] ?? 0) >= relevantMin).length;
  return hits / slice.length;
}

export async function runLexicalBenchmark(
  db: Db,
  options: {
    dataset?: SearchEvalDataset;
    datasetVersion?: string;
    pageSize?: number;
  } = {},
): Promise<{ summary: LexicalBenchmarkSummary; run: SearchBenchmarkRun }> {
  const dataset =
    options.dataset ??
    loadSearchEvalDataset(
      defaultSearchEvalPath(options.datasetVersion ?? "v1"),
    );
  const pageSize = options.pageSize ?? 10;
  const latencies: number[] = [];
  let zeroResultCount = 0;
  let resultCountSum = 0;
  let exactGroupHits = 0;
  let exactGroupTotal = 0;
  const ndcgs: number[] = [];
  const precisions: number[] = [];
  let labeledQueryCount = 0;

  for (const item of dataset.queries) {
    const started = Date.now();
    const catalog = await queryCatalog(db, {
      q: item.query,
      page: 1,
      pageSize,
    });
    const latency = Date.now() - started;
    latencies.push(latency);
    resultCountSum += catalog.total;
    if (catalog.total === 0) zeroResultCount += 1;

    const retrievedIds = catalog.items.map((c) => c.id);
    const labels = item.expectedLabels ?? {};
    if (Object.keys(labels).length > 0) {
      labeledQueryCount += 1;
      const ndcg = ndcgAtK(retrievedIds, labels, 10);
      if (ndcg !== null) ndcgs.push(ndcg);
      const p5 = precisionAtK(retrievedIds, labels, 5);
      if (p5 !== null) precisions.push(p5);
    }

    if (item.group === "EXACT") {
      exactGroupTotal += 1;
      const q = item.query.toLowerCase();
      const hit = catalog.items.some((c) =>
        c.title.toLowerCase().includes(q),
      );
      if (hit) exactGroupHits += 1;
    }
  }

  const queryCount = dataset.queries.length;
  const summary: LexicalBenchmarkSummary = {
    datasetVersion: dataset.version,
    retrievalMode: "LEXICAL",
    rankingConfigVersion: LEXICAL_RANKING_CONFIG_VERSION,
    queryCount,
    labeledQueryCount,
    zeroResultCount,
    zeroResultRate: queryCount > 0 ? zeroResultCount / queryCount : 0,
    exactTitleHitRate:
      exactGroupTotal > 0 ? exactGroupHits / exactGroupTotal : null,
    latencyP95Ms: percentile([...latencies].sort((a, b) => a - b), 95),
    meanResultCount: queryCount > 0 ? resultCountSum / queryCount : 0,
    ndcgAt10:
      ndcgs.length > 0
        ? ndcgs.reduce((a, b) => a + b, 0) / ndcgs.length
        : null,
    precisionAt5:
      precisions.length > 0
        ? precisions.reduce((a, b) => a + b, 0) / precisions.length
        : null,
    note:
      labeledQueryCount === 0
        ? "expectedLabels are empty stubs — NDCG/P@5 stay null until Gate B labeling."
        : "Graded labels present for a subset of queries.",
  };

  const values: NewSearchBenchmarkRun = {
    datasetVersion: summary.datasetVersion,
    retrievalMode: "LEXICAL",
    rankingConfigVersion: summary.rankingConfigVersion,
    embeddingModel: null,
    ndcgAt10:
      summary.ndcgAt10 === null ? null : summary.ndcgAt10.toFixed(4),
    precisionAt5:
      summary.precisionAt5 === null
        ? null
        : summary.precisionAt5.toFixed(4),
    exactTitleSuccess:
      summary.exactTitleHitRate === null
        ? null
        : summary.exactTitleHitRate.toFixed(4),
    latencyP95: summary.latencyP95Ms,
    costEstimate: "0",
    labelDecayRate: null,
    metricsJson: summary,
  };

  const rows = await db.insert(searchBenchmarkRuns).values(values).returning();
  const run = rows[0];
  if (!run) {
    throw new Error("Failed to persist search_benchmark_runs row");
  }

  return { summary, run };
}

export async function listRecentBenchmarkRuns(db: Db, limit = 10) {
  return db
    .select()
    .from(searchBenchmarkRuns)
    .orderBy(desc(searchBenchmarkRuns.createdAt))
    .limit(limit);
}
