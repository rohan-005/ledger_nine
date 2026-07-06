import "server-only";

export interface NormalizedProviderError {
  type: "RATE_LIMIT" | "INTEGRATION_ERROR" | "PROVIDER_UNAVAILABLE";
  provider: string;
  message: string;
  retryAfter?: number;
  originalStatus?: number;
}

export function detectProviderRateLimit(error: unknown, provider: string): NormalizedProviderError | null {
  if (!error) return null;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMsg = errorMessage.toLowerCase();

  // Common phrases indicating rate limits or quota exhaustion
  const rateLimitPhrases = [
    "http 429",
    "429",
    "quota exceeded",
    "rate limit exceeded",
    "too many requests",
    "resource exhausted",
    "provider quota exceeded",
    "daily limit reached",
    "monthly limit reached",
    "request limit reached"
  ];

  const isRateLimit = rateLimitPhrases.some(phrase => lowerMsg.includes(phrase));

  if (isRateLimit) {
    let retryAfter: number | undefined;
    
    // Attempt to extract retryAfter headers or metadata if present
    if (typeof error === "object" && error !== null) {
      const anyErr = error as any;
      if (typeof anyErr.retryAfter === "number") {
        retryAfter = anyErr.retryAfter;
      } else if (anyErr.metadata && typeof anyErr.metadata === "object") {
        if (typeof anyErr.metadata.retryAfter === "number") {
          retryAfter = anyErr.metadata.retryAfter;
        } else if (anyErr.metadata.retryAfter) {
          retryAfter = Number(anyErr.metadata.retryAfter);
        }
      }
    }

    return {
      type: "RATE_LIMIT",
      provider,
      message: "API limit reached",
      retryAfter,
      originalStatus: 429
    };
  }

  return null;
}
