import "server-only";
import { GoogleGenAI } from "@google/genai";
import { LLMProvider, GenerateOptions, LLMResponse } from "../llm.types";
import { getGeminiApiKey } from "@/src/lib/env";
import { IntegrationError } from "@/src/lib/errors";

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI | null = null;
  private readonly modelName: string;

  constructor(modelName: string) {
    this.modelName = modelName;
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: getGeminiApiKey() });
    }
    return this.client;
  }

  async generateText(prompt: string, options: GenerateOptions = {}): Promise<LLMResponse> {
    const startTime = Date.now();
    try {
      const client = this.getClient();
      const response = await client.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction: options.systemInstruction,
          responseMimeType: options.responseSchema ? "application/json" : undefined,
          responseSchema: options.responseSchema,
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens,
        },
      });

      const latencyMs = Date.now() - startTime;
      const text = response.text;
      if (text === undefined || text === null) {
        throw new IntegrationError("Gemini generated empty response", "gemini", "Response text was undefined");
      }

      return {
        text,
        latencyMs,
        model: this.modelName,
        provider: "gemini",
      };
    } catch (error: unknown) {
      if (error instanceof IntegrationError) throw error;
      throw new IntegrationError(
        "Gemini generate content failed",
        "gemini",
        error instanceof Error ? error.message : "Unknown Gemini API error",
        false,
        undefined,
        error
      );
    }
  }
}
