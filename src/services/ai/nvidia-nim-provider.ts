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
      reasoning_content?: string | null;
    };
    finish_reason?: string | null;
  }>;
};

const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * Enough for the analysis object; without a cap a reasoning model can emit
 * tokens until the serverless function is killed.
 */
const MAX_OUTPUT_TOKENS = 1_600;

/** Below this there is no point starting a second attempt. */
const MIN_RETRY_BUDGET_MS = 8_000;

/**
 * Nemotron reasoning models think by default and NVIDIA documents
 * temperature 1.0 / top_p 0.95 for them.
 */
function isReasoningModel(model: string): boolean {
  return /nemotron/i.test(model);
}

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
    // Both attempts share one budget, otherwise the retry alone can outlive
    // the serverless function limit.
    const deadline = Date.now() + this.timeoutMs;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const remainingMs = deadline - Date.now();
      if (attempt > 0 && remainingMs < MIN_RETRY_BUDGET_MS) {
        break;
      }

      try {
        // Not every NIM model honours response_format or chat_template_kwargs;
        // the second attempt drops both.
        const content = await this.complete(input, {
          tuned: attempt === 0,
          timeoutMs: attempt === 0 ? this.timeoutMs : remainingMs,
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
    options: { tuned: boolean; timeoutMs: number },
  ): Promise<string> {
    const prompt = buildCourseAnalysisPrompt(input);
    const reasoning = isReasoningModel(this.model);
    // Without this the request can hang until the serverless function is killed.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

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
          // Nemotron degrades badly outside its documented sampling settings.
          temperature: reasoning ? 1 : 0.1,
          ...(reasoning ? { top_p: 0.95 } : {}),
          max_tokens: MAX_OUTPUT_TOKENS,
          ...(options.tuned
            ? {
                response_format: { type: "json_object" },
                // Reasoning is on by default and burns the whole time budget
                // before the model emits any JSON.
                ...(reasoning
                  ? { chat_template_kwargs: { enable_thinking: false } }
                  : {}),
              }
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
          `NVIDIA request timed out after ${options.timeoutMs}ms (model ${this.model})`,
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
    const choice = payload.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
      // A reasoning model that spent the whole cap thinking returns empty
      // content with finish_reason "length" — say so instead of "empty".
      throw new AIParseError(
        "empty",
        choice?.finish_reason === "length"
          ? `model ${this.model} hit the ${MAX_OUTPUT_TOKENS}-token cap before answering (reasoning not disabled?)`
          : `no message content from model ${this.model}`,
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
