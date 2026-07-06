import "server-only";
import { llmRouter } from "@/src/core/llm/llm-router";
import { GenerateOptions } from "@/src/core/llm/llm.types";

export const geminiClient = {
  async generateText(prompt: string, options?: GenerateOptions & { responseSchema?: any }) {
    return llmRouter.generateText(prompt, options);
  }
};
