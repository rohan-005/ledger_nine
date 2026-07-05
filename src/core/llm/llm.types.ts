export interface GenerateOptions {
  systemInstruction?: string;
  responseSchema?: Record<string, unknown>; // JSON Schema (optional)
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LLMResponse {
  text: string;
  latencyMs: number;
  model: string;
  provider: string;
}

export interface LLMProvider {
  generateText(prompt: string, options?: GenerateOptions): Promise<LLMResponse>;
}
