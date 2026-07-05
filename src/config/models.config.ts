export const MODELS_CONFIG = {
  primarySpecialist: {
    provider: "gemini" as const,
    model: "gemini-2.5-flash",
  },
  fallbackSpecialist: {
    provider: "groq" as const,
    model: "llama-3.3-70b-versatile",
  },
  committee: {
    provider: "gemini" as const,
    model: "gemini-2.5-pro",
  },
};

export type LLMModelProvider = "gemini" | "groq";
export type ModelConfig = typeof MODELS_CONFIG.primarySpecialist;
