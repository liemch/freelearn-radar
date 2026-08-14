/**
 * EmbeddingProvider — separate from AIProvider (plan §88.3).
 * generate(texts[]) → vectors[]; swap providers without touching business layer.
 */

export type EmbeddingGenerateResult = {
  embeddings: number[][];
  model: string;
  usageTokens?: number;
  latencyMs: number;
};

export interface EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  generate(texts: string[]): Promise<EmbeddingGenerateResult>;
}

/** Deterministic unit vectors for tests — never call a network. */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;

  constructor(options?: { model?: string; dimension?: number }) {
    this.model = options?.model ?? "fake-embed-v1";
    this.dimension = options?.dimension ?? 1024;
  }

  async generate(texts: string[]): Promise<EmbeddingGenerateResult> {
    const started = Date.now();
    const embeddings = texts.map((text) => hashToUnitVector(text, this.dimension));
    return {
      embeddings,
      model: this.model,
      usageTokens: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      latencyMs: Date.now() - started,
    };
  }
}

function hashToUnitVector(text: string, dimension: number): number[] {
  const out = new Array<number>(dimension).fill(0);
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
    out[Math.abs(h) % dimension] += 1;
  }
  let norm = 0;
  for (const v of out) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return out.map((v) => v / norm);
}

export type HttpEmbeddingConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  dimension: number;
  timeoutMs?: number;
};

/**
 * OpenAI-compatible `/embeddings` client (NVIDIA NIM, OpenAI, etc.).
 */
export class HttpEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: HttpEmbeddingConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.model = config.model;
    this.dimension = config.dimension;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async generate(texts: string[]): Promise<EmbeddingGenerateResult> {
    if (texts.length === 0) {
      return {
        embeddings: [],
        model: this.model,
        usageTokens: 0,
        latencyMs: 0,
      };
    }

    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          encoding_format: "float",
        }),
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => ({}))) as {
        data?: Array<{ embedding?: number[]; index?: number }>;
        usage?: { total_tokens?: number };
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(
          `Embedding request failed (${response.status}): ${
            body.error?.message ?? "unknown"
          }`,
        );
      }

      const rows = [...(body.data ?? [])].sort(
        (a, b) => (a.index ?? 0) - (b.index ?? 0),
      );
      const embeddings = rows.map((row) => {
        const vec = row.embedding ?? [];
        if (vec.length !== this.dimension) {
          throw new Error(
            `Embedding dimension mismatch: expected ${this.dimension}, got ${vec.length}`,
          );
        }
        return vec;
      });

      if (embeddings.length !== texts.length) {
        throw new Error(
          `Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`,
        );
      }

      return {
        embeddings,
        model: this.model,
        usageTokens: body.usage?.total_tokens,
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createEmbeddingProviderFromEnv(env: {
  NVIDIA_API_KEY: string;
  NVIDIA_BASE_URL: string;
  EMBEDDING_PROVIDER: string;
  EMBEDDING_MODEL: string;
  EMBEDDING_DIMENSION: number;
  EMBEDDING_QUERY_TIMEOUT_MS: number;
}): EmbeddingProvider | null {
  if (env.EMBEDDING_PROVIDER === "fake") {
    return new FakeEmbeddingProvider({
      model: env.EMBEDDING_MODEL || "fake-embed-v1",
      dimension: env.EMBEDDING_DIMENSION,
    });
  }

  if (!env.NVIDIA_API_KEY) {
    return null;
  }

  return new HttpEmbeddingProvider({
    apiKey: env.NVIDIA_API_KEY,
    baseUrl: env.NVIDIA_BASE_URL,
    model: env.EMBEDDING_MODEL,
    dimension: env.EMBEDDING_DIMENSION,
    // Query-path budget is 400ms; document backfill needs a full HTTP timeout.
    timeoutMs: Math.max(env.EMBEDDING_QUERY_TIMEOUT_MS, 30_000),
  });
}
