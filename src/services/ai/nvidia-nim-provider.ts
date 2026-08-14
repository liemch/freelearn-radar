import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  AIParseError,
  buildCourseAnalysisPrompt,
  parseCourseAnalysisJson,
  type AIProvider,
  type CourseAnalysis,
  type CourseAnalysisInput,
} from "@/services/ai/ai-provider";

type FetchLike = typeof fetch;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const DEFAULT_TIMEOUT_MS = 45_000;

export class NvidiaNimProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
  }) {
    let env: ReturnType<typeof getServerEnv> | null = null;
    try {
      env = getServerEnv();
    } catch {
      env = null;
    }

    this.apiKey = options?.apiKey ?? env?.NVIDIA_API_KEY ?? "";
    this.baseUrl =
      options?.baseUrl ??
      env?.NVIDIA_BASE_URL ??
      "https://integrate.api.nvidia.com/v1";
    this.model =
      options?.model ||
      env?.NVIDIA_MODEL ||
      "nvidia/nemotron-3-super-120b-a12b";
    this.timeoutMs =
      options?.timeoutMs ?? env?.AI_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options?.fetchImpl ?? fetch;

    if (!this.apiKey) {
      throw new Error("NVIDIA_API_KEY is required");
    }
  }

  async analyzeCourse(input: CourseAnalysisInput): Promise<CourseAnalysis> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        // Not every NIM model honours response_format; retry without it.
        const content = await this.complete(input, {
          jsonMode: attempt === 0,
        });
        return parseCourseAnalysisJson(content);
      } catch (error) {
        lastError = error;
        logger.warn("ai.nvidia.analyze", {
          status: "retry",
          attempt,
          model: this.model,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    logger.error("ai.nvidia.analyze", {
      status: "error",
      error: lastError instanceof Error ? lastError.message : "Unknown error",
    });

    throw lastError instanceof Error
      ? lastError
      : new Error("AI analysis failed");
  }

  async categorizeCourse(input: CourseAnalysisInput): Promise<string[]> {
    const analysis = await this.analyzeCourse(input);
    return analysis.categories;
  }

  async summarizeCourse(input: CourseAnalysisInput): Promise<string> {
    const analysis = await this.analyzeCourse(input);
    return analysis.summary_vi;
  }

  private async complete(
    input: CourseAnalysisInput,
    options: { jsonMode: boolean },
  ): Promise<string> {
    const prompt = buildCourseAnalysisPrompt(input);
    // Without this the request can hang until the serverless function is killed.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.1,
          ...(options.jsonMode
            ? { response_format: { type: "json_object" } }
            : {}),
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `NVIDIA request timed out after ${this.timeoutMs}ms (model ${this.model})`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `NVIDIA request failed (${response.status}): ${body.slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new AIParseError(
        "empty",
        `no message content from model ${this.model}`,
      );
    }

    return content;
  }
}

export function createAIProvider(options?: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: FetchLike;
}): AIProvider {
  return new NvidiaNimProvider(options);
}
