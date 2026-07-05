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
      let systemInstruction = options.systemInstruction;
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
