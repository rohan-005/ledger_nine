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
      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
      if (options.systemInstruction) {
        messages.push({ role: "system", content: options.systemInstruction });
      }
      messages.push({ role: "user", content: prompt });

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
      throw new IntegrationError(
        "Groq generate content failed",
        "groq",
        error instanceof Error ? error.message : "Unknown Groq API error",
        false,
        undefined,
        error
      );
    }
  }
}
