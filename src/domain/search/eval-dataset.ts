import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

export const searchEvalLocaleSchema = z.enum(["EN", "VI", "VI_NO_DIACRITIC"]);
export const searchEvalGroupSchema = z.enum([
  "EXACT",
  "KEYWORD",
  "NL",
  "CONSTRAINT",
  "CROSS_LANG",
  "NEGATIVE",
]);

export const searchEvalQuerySchema = z.object({
  id: z.string().min(1),
  locale: searchEvalLocaleSchema,
  group: searchEvalGroupSchema,
  query: z.string().min(1),
  /** Graded relevance stubs: courseId → 0..3. Empty until human labeling. */
  expectedLabels: z.record(z.string(), z.number().int().min(0).max(3)).default({}),
  notes: z.string().optional(),
});

export const searchEvalDatasetSchema = z.object({
  version: z.string().min(1),
  catalogSnapshotId: z.string().nullable(),
  catalogSnapshotAt: z.string().nullable(),
  description: z.string(),
  queries: z.array(searchEvalQuerySchema).min(60),
});

export type SearchEvalQuery = z.infer<typeof searchEvalQuerySchema>;
export type SearchEvalDataset = z.infer<typeof searchEvalDatasetSchema>;

export function defaultSearchEvalPath(
  datasetVersion = "v1",
): string {
  return path.join(
    process.cwd(),
    "data",
    "search-eval",
    datasetVersion,
    "queries.json",
  );
}

export function loadSearchEvalDataset(
  filePath = defaultSearchEvalPath(),
): SearchEvalDataset {
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  return searchEvalDatasetSchema.parse(raw);
}
