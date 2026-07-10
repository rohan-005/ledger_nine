import "server-only";

const SECRET_ENV_VARS = [
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "TAVILY_API_KEY",
  "FMP_API_KEY",
  "ALPHA_VANTAGE_API_KEY",
  "FINNHUB_API_KEY",
  "NEWS_API_KEY",
  "TWELVE_DATA_API_KEY",
  "EODHD_API_KEY",
  "DATABASE_URL",
];

/**
 * Redacts known sensitive environment variables and URL query parameter values.
 */
export function redactSecrets(input: string): string {
  if (!input) return input;
  let result = input;

  // 1. Redact direct environment variable matches
  for (const envVar of SECRET_ENV_VARS) {
    const val = process.env[envVar];
    if (val && val.trim().length > 4) {
      // Escape special regex characters
      const escaped = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(escaped, "g");
      result = result.replace(regex, "[REDACTED]");
    }
  }

  // 2. Redact common query string secrets (e.g., apikey=..., token=..., key=...)
  // Match key patterns like (apikey|token|api_key|apiKey|access_token|secret)=([^&\s]+)
  result = result.replace(
    /([&?])(apikey|token|api_key|apiKey|access_token|secret|key)=([^&\s\"\'\>]+)/gi,
    "$1$2=[REDACTED]"
  );

  // 3. Redact Authorization header values in strings (e.g. Bearer xyz)
  result = result.replace(
    /(bearer\s+)([^&\s\"\'\>,\}]+)/gi,
    "$1[REDACTED]"
  );

  return result;
}

/**
 * Deep redacts any sensitive string values inside an object.
 */
export function redactObjectSecrets(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === "string") {
    return redactSecrets(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObjectSecrets(item));
  }
  if (typeof obj === "object") {
    const copy: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      // If key looks like it has a token or api key, redact its value directly
      if (
        /api_?key|token|secret|password|auth|url/i.test(key) &&
        typeof obj[key] === "string"
      ) {
        copy[key] = "[REDACTED]";
      } else {
        copy[key] = redactObjectSecrets(obj[key]);
      }
    }
    return copy;
  }
  return obj;
}
