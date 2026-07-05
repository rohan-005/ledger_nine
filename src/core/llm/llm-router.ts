import { GeminiProvider } from "./providers/gemini.provider";
import { GroqProvider } from "./providers/groq.provider";
import { GenerateOptions, LLMResponse, LLMProvider } from "./llm.types";
import { MODELS_CONFIG } from "@/src/config/models.config";
import { agentRunRepository } from "@/src/db/repositories/agent-run.repository";
import { logger } from "@/src/lib/logger";
import { Evidence } from "../evidence/evidence.types";
import { compressContext } from "./context-compressor";

export class LLMRouter {
  private readonly primaryProvider: LLMProvider;
  private readonly fallbackProvider: LLMProvider;

  constructor(primary?: LLMProvider, fallback?: LLMProvider) {
    this.primaryProvider = primary ?? new GeminiProvider(MODELS_CONFIG.primarySpecialist.model);
    this.fallbackProvider = fallback ?? new GroqProvider(MODELS_CONFIG.fallbackSpecialist.model);
  }

  /**
   * Generates text by calling primary specialist (Gemini) up to 2 times, then falling back to Groq.
   * If a fallback is triggered, records this in the database for the given agentRunId.
   * If a prompt builder function and evidence pool are provided, compresses the evidence
   * before constructing the fallback prompt to avoid exceeding token limits.
   */
  async generateText(
    promptOrBuilder: string | ((compressedEvidence: Evidence[]) => string),
    options: GenerateOptions & {
      agentRunId?: string;
      evidence?: readonly Evidence[];
      category?: string;
    } = {}
  ): Promise<LLMResponse> {
    const { agentRunId, evidence, category, ...restOptions } = options;

    let prompt = typeof promptOrBuilder === "string"
      ? promptOrBuilder
      : promptOrBuilder(evidence ? [...evidence] : []);

    const maxPrimaryAttempts = 2;
    let attempt = 1;
    let lastPrimaryError: unknown = null;

    while (attempt <= maxPrimaryAttempts) {
      try {
        logger.info(`LLM Router: Attempting primary specialist (Gemini)`, { attempt });
        return await this.primaryProvider.generateText(prompt, restOptions);
      } catch (error: unknown) {
        lastPrimaryError = error;
        logger.warn(`LLM Router: Primary specialist failed on attempt ${attempt}`, { error });

        // If the error is classified as non-retryable (e.g. hard rate-limit),
        // skip further primary attempts and fall through to the fallback immediately.
        const isNonRetryable =
          error instanceof Error &&
          "retryable" in error &&
          (error as { retryable: boolean }).retryable === false;

        if (isNonRetryable || attempt === maxPrimaryAttempts) {
          break;
        }
        attempt++;
        // Short backoff before retrying primary
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Trigger Groq Fallback
    logger.info(`LLM Router: Triggering fallback to Groq specialist`);
    const fallbackReason = `Primary specialist (Gemini) failed after ${maxPrimaryAttempts} attempts.`;

    if (agentRunId) {
      try {
        await agentRunRepository.recordFallback(agentRunId, fallbackReason);
      } catch (err) {
        logger.warn("Failed to log fallback event to the database", { err });
      }
    }

    // Apply context compression if evidence is present and builder is dynamic
    if (evidence && typeof promptOrBuilder === "function") {
      const compressed = compressContext(evidence, { maxCharacters: 4000, relevantCategory: category });
      prompt = promptOrBuilder(compressed);
      logger.info(`LLM Router: Rebuilt fallback prompt with compressed context`, {
        originalCount: evidence.length,
        compressedCount: compressed.length,
      });
    }

    try {
      return await this.fallbackProvider.generateText(prompt, restOptions);
    } catch (fallbackError: unknown) {
      logger.error("LLM Router: Fallback specialist (Groq) also failed", { fallbackError });
      throw fallbackError;
    }
  }
}
export const llmRouter = new LLMRouter();
