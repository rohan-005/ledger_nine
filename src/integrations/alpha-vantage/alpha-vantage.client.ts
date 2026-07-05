import "server-only";
import { getAlphaVantageApiKey } from "@/src/lib/env";
import { IntegrationError } from "@/src/lib/errors";
import { cacheRepository } from "@/src/db/repositories/cache.repository";
import { generateId } from "@/src/lib/ids";
import { logger } from "@/src/lib/logger";

const BASE_URL = "https://www.alphavantage.co/query";

async function avFetch<T>(functionName: string, ticker: string): Promise<T> {
  const cleanTicker = ticker.toUpperCase().trim();
  const dateBucket = new Date().toISOString().slice(0, 10); // Daily cache bucket
  const cacheKey = `alphavantage:${cleanTicker}:${functionName}:${dateBucket}`;

  // 1. Try cache first
  try {
    const cached = await cacheRepository.getValid("alpha_vantage", cacheKey);
    if (cached) {
      logger.info("AlphaVantage cache hit", { ticker: cleanTicker, functionName });
      return cached as T;
    }
  } catch (error) {
    logger.warn("Failed to check AlphaVantage cache, proceeding to API", { error });
  }

  let apiKey: string;
  try {
    apiKey = getAlphaVantageApiKey();
  } catch (err) {
    throw new IntegrationError("AlphaVantage config error", "AlphaVantage", "ALPHA_VANTAGE_API_KEY is not configured", false, undefined, err);
  }

  const queryParams = new URLSearchParams({
    function: functionName,
    symbol: cleanTicker,
    apikey: apiKey,
  });

  const url = `${BASE_URL}?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000), // 8s timeout
    });

    if (!response.ok) {
      throw new IntegrationError("AlphaVantage HTTP error", "AlphaVantage", `HTTP error status ${response.status}`);
    }

    const text = await response.text();
    let data: T;
    try {
      data = JSON.parse(text);
      if (data && typeof data === "object" && (data as any)["Note"]) {
        throw new IntegrationError("AlphaVantage rate limit warning", "AlphaVantage", "API rate limit warning: " + (data as any)["Note"], true);
      }
    } catch (err: unknown) {
      if (err instanceof IntegrationError) throw err;
      throw new IntegrationError("AlphaVantage parse error", "AlphaVantage", "Failed to parse JSON response from Alpha Vantage API", false, undefined, err);
    }

    // 2. Write to cache
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours TTL
      await cacheRepository.set({
        id: generateId("run").replace("run_", "ch_"),
        provider: "alpha_vantage",
        cacheKey,
        requestFingerprint: cacheKey,
        payload: JSON.stringify(data),
        expiresAt,
      });
    } catch (cacheErr) {
      logger.warn("Failed to write AlphaVantage response to cache", { cacheErr });
    }

    return data;
  } catch (error: unknown) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError("AlphaVantage request failed", "AlphaVantage", error instanceof Error ? error.message : "Request failed", false, undefined, error);
  }
}

export const alphaVantageClient = {
  async getEarnings(ticker: string) {
    return avFetch<unknown>("EARNINGS", ticker);
  },
};
