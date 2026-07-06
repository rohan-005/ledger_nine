import "server-only";
import { getNewsApiKey } from "@/src/lib/env";
import { cacheRepository } from "@/src/db/repositories/cache.repository";
import { generateId } from "@/src/lib/ids";
import { logger } from "@/src/lib/logger";

const BASE_URL = "https://newsapi.org/v2";

async function newsapiFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  const apiKey = getNewsApiKey();
  if (!apiKey) {
    logger.warn(`NewsAPI: API key is not configured, skipping fetch for ${endpoint}`);
    return null;
  }

  const query = params.q || "unknown";
  const dateBucket = new Date().toISOString().slice(0, 10);
  const cacheKey = `newsapi:${query}:${endpoint}:${JSON.stringify(params)}:${dateBucket}`;

  // Check cache
  try {
    const cached = await cacheRepository.getValid("newsapi", cacheKey);
    if (cached) {
      logger.info("NewsAPI cache hit", { query, endpoint });
      return cached as T;
    }
  } catch (error) {
    logger.warn("Failed to check NewsAPI cache", { error });
  }

  const queryParams = new URLSearchParams({ ...params, apiKey });
  const url = `${BASE_URL}/${endpoint}?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      logger.warn(`NewsAPI HTTP error: status ${response.status} for ${endpoint}`);
      return null;
    }

    const text = await response.text();
    const data = JSON.parse(text) as T;

    // Cache results
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      await cacheRepository.set({
        id: generateId("run").replace("run_", "ch_"),
        provider: "newsapi",
        cacheKey,
        requestFingerprint: cacheKey,
        payload: JSON.stringify(data),
        expiresAt,
      });
    } catch (cacheErr) {
      logger.warn("Failed to cache NewsAPI response", { cacheErr });
    }

    return data;
  } catch (error) {
    logger.warn("NewsAPI fetch failed, using fallback", { error });
    return null;
  }
}

export const newsapiClient = {
  async searchEverything(query: string, limit = 10) {
    return newsapiFetch<Record<string, any>>("everything", {
      q: query,
      sortBy: "relevance",
      pageSize: String(limit),
      language: "en"
    });
  }
};
