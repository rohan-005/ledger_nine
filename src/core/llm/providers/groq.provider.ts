import "server-only";
import Groq from "groq-sdk";
import { LLMProvider, GenerateOptions, LLMResponse } from "../llm.types";
import { getGroqApiKey } from "@/src/lib/env";
import { IntegrationError } from "@/src/lib/errors";

export class GroqProvider implements LLMProvider {
  private client: Groq | null = null;
  private readonly modelName: string;

  constructor(modelName: string) {
    this.modelName = modelName;
  }

  private getClient(): Groq {
    if (!this.client) {
      this.client = new Groq({ apiKey: getGroqApiKey() });
    }
    return this.client;
  }

  async generateText(prompt: string, options: GenerateOptions = {}): Promise<LLMResponse> {
    const startTime = Date.now();
    try {
      let userPrompt = prompt;
      const systemInstruction = options.systemInstruction;
      if (options.responseSchema) {
        const hasJsonWord = (systemInstruction && /json/i.test(systemInstruction)) || /json/i.test(userPrompt);
        if (!hasJsonWord) {
          userPrompt += "\n\nCRITICAL: You must return a valid JSON object matching the specified schema.";
        }
      }

      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
      }
      messages.push({ role: "user", content: userPrompt });

      const client = this.getClient();
      const response = await client.chat.completions.create({
        model: this.modelName,
        messages,
        temperature: options.temperature,
        max_completion_tokens: options.maxOutputTokens, // Groq uses max_completion_tokens
        response_format: options.responseSchema ? { type: "json_object" } : undefined,
      });

      const latencyMs = Date.now() - startTime;
      const text = response.choices[0]?.message?.content;
      if (text === undefined || text === null) {
        throw new IntegrationError("Groq generated empty response", "groq", "Response text was undefined");
      }

      return {
        text,
        latencyMs,
        model: this.modelName,
        provider: "groq",
      };
    } catch (error: unknown) {
      if (error instanceof IntegrationError) throw error;

      // Extract a sanitized message — never expose raw Groq API bodies which
      // may contain org IDs, token limits, billing URLs, etc.
      let safeMessage = "Unknown Groq API error";
      if (error instanceof Error) {
        const raw = error.message || "";
        // Check for rate-limit / 429 condition
        if (
          raw.includes("429") ||
          raw.toLowerCase().includes("rate limit") ||
          raw.toLowerCase().includes("rate_limit") ||
          (error as any).status === 429
        ) {
          safeMessage = "Rate limit reached. Provider quota exceeded.";
        } else if (raw.includes("401") || raw.toLowerCase().includes("unauthorized")) {
          safeMessage = "Provider authentication failed.";
        } else if (raw.includes("503") || raw.toLowerCase().includes("unavailable")) {
          safeMessage = "Provider temporarily unavailable.";
        } else {
          // General truncation — do not expose full body
          safeMessage = raw.length > 120 ? raw.slice(0, 120) + "…" : raw;
        }
      }

      throw new IntegrationError(
        "Groq generate content failed",
        "groq",
        safeMessage,
        false,
        { status: (error as any)?.status ?? undefined },
        error
      );
    }
  }
}
