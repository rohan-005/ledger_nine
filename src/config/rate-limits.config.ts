export const RATE_LIMITS_CONFIG = {
  gemini: {
    specialistRpm: 15,
    committeeRpm: 5,
    backoffMs: 1000,
    maxRetries: 1,
  },
  groq: {
    rpm: 30,
  },
  tavily: {
    rpm: 20,
    useCache: true,
  },
  sec: {
    delayMs: 150, // self-throttling delay to avoid blocking
  },
};
