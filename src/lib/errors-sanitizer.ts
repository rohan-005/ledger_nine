import "server-only";

/**
 * Scrubs credentials, billing links, project/organization IDs, and key values from provider failures,
 * producing a customer-safe error message.
 */
export function sanitizeErrorMessage(message: string | null | undefined): string {
  if (!message) {
    return "An unknown error occurred during execution.";
  }

  const originalLower = message.toLowerCase();
  let sanitized = message;

  // 1. Scrub potential credentials, keys, or bearer tokens
  sanitized = sanitized.replace(
    /(api[-_]?key|secret|token|auth|password|signature|key|credential)s?\b[\s=:"]+([a-zA-Z0-9_\-]{8,})/gi,
    "$1=***"
  );
  sanitized = sanitized.replace(/bearer\s+[a-zA-Z0-9_\-\.\~]+/gi, "Bearer ***");

  // 2. Scrub billing and account links (URLs)
  sanitized = sanitized.replace(/https?:\/\/[^\s]*billing[^\s]*/gi, "[Billing URL Removed]");
  sanitized = sanitized.replace(/https?:\/\/[^\s]*console\.cloud\.google[^\s]*/gi, "[Console URL Removed]");
  sanitized = sanitized.replace(/https?:\/\/[^\s]*platform\.openai[^\s]*/gi, "[Platform URL Removed]");
  sanitized = sanitized.replace(/https?:\/\/[^\s]*anthropic[^\s]*/gi, "[Anthropic URL Removed]");
  sanitized = sanitized.replace(/https?:\/\/[^\s]*tavily[^\s]*/gi, "[Tavily URL Removed]");

  // 3. Scrub project IDs and organization IDs
  sanitized = sanitized.replace(
    /\b(project|proj|org|organization|account|user|billing)[-_]id\b[\s=:"]+([a-zA-Z0-9_\-]{4,})/gi,
    "$1_id=***"
  );
  sanitized = sanitized.replace(/\borg-[a-zA-Z0-9_\-]{8,}/gi, "org-***");
  sanitized = sanitized.replace(/\bproject-[a-zA-Z0-9_\-]{8,}/gi, "project-***");

  // 4. Return customer-friendly messages for capacity/billing/rate limits
  const lowerMsg = sanitized.toLowerCase();
  if (
    lowerMsg.includes("billing") ||
    lowerMsg.includes("quota") ||
    lowerMsg.includes("rate limit") ||
    lowerMsg.includes("429") ||
    lowerMsg.includes("insufficient funds") ||
    lowerMsg.includes("credit") ||
    lowerMsg.includes("balance") ||
    lowerMsg.includes("payment")
  ) {
    let providerName = "";
    if (originalLower.includes("fmp") || originalLower.includes("financial modeling prep")) {
      providerName = "FMP";
    } else if (originalLower.includes("finnhub")) {
      providerName = "Finnhub";
    } else if (originalLower.includes("newsapi") || originalLower.includes("news api")) {
      providerName = "NewsAPI";
    } else if (originalLower.includes("tavily")) {
      providerName = "Tavily";
    } else if (originalLower.includes("gemini") || originalLower.includes("google")) {
      providerName = "Gemini";
    } else if (originalLower.includes("groq")) {
      providerName = "Groq";
    } else if (originalLower.includes("openrouter")) {
      providerName = "OpenRouter";
    }

    if (providerName) {
      return `API limit reached for ${providerName}`;
    }
    return "API limit reached";
  }

  return sanitized;
}
