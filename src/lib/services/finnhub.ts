import "server-only";
import { getFinnhubApiKey } from "@/src/lib/env";
import { IntegrationError } from "@/src/lib/errors";
import { cacheRepository } from "@/src/db/repositories/cache.repository";
import { generateId } from "@/src/lib/ids";
import { logger } from "@/src/lib/logger";

const BASE_URL = "https://finnhub.io/api/v1";

async function finnhubFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  const apiKey = getFinnhubApiKey();
  if (!apiKey) {
    logger.warn(`Finnhub: API key is not configured, skipping fetch for ${endpoint}`);
    return null;
  }

  const symbol = (params.symbol || "unknown").toUpperCase();
  const dateBucket = new Date().toISOString().slice(0, 10);
  const cacheKey = `finnhub:${symbol}:${endpoint}:${JSON.stringify(params)}:${dateBucket}`;

  // Check cache
  try {
    const cached = await cacheRepository.getValid("finnhub", cacheKey);
    if (cached) {
      logger.info("Finnhub cache hit", { symbol, endpoint });
      return cached as T;
    }
  } catch (error) {
    logger.warn("Failed to check Finnhub cache", { error });
  }

  const queryParams = new URLSearchParams({ ...params, token: apiKey });
  const url = `${BASE_URL}/${endpoint}?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      logger.warn(`Finnhub HTTP error: status ${response.status} for ${endpoint}`);
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
        provider: "finnhub",
        cacheKey,
        requestFingerprint: cacheKey,
        payload: JSON.stringify(data),
        expiresAt,
      });
    } catch (cacheErr) {
      logger.warn("Failed to cache Finnhub response", { cacheErr });
    }

    return data;
  } catch (error) {
    logger.warn("Finnhub fetch failed, using fallback", { error });
    return null;
  }
}

export const finnhubClient = {
  async getCompanyProfile(ticker: string) {
    return finnhubFetch<Record<string, any>>("stock/profile2", { symbol: ticker });
  },

  async getQuote(ticker: string) {
    return finnhubFetch<Record<string, any>>("quote", { symbol: ticker });
  },

  async getCompanyNews(ticker: string, fromDate: string, toDate: string) {
    return finnhubFetch<any[]>("company-news", { symbol: ticker, from: fromDate, to: toDate });
  }
};
