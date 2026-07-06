import "server-only";
import { getFmpApiKey } from "@/src/lib/env";
import { IntegrationError, RateLimitError } from "@/src/lib/errors";
import { cacheRepository } from "@/src/db/repositories/cache.repository";
import { generateId } from "@/src/lib/ids";
import { logger } from "@/src/lib/logger";

const BASE_URL = "https://financialmodelingprep.com/stable";

async function fmpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const ticker = (params.symbol || params.query || "unknown").toUpperCase();
  const limit = params.limit || "";
  const period = params.period || "";
  const dateBucket = new Date().toISOString().slice(0, 10); // Daily cache bucket
  const cacheKey = `fmp:${ticker}:${endpoint}:${period}:${limit}:${dateBucket}`;

  // 1. Try cache first
  try {
    const cached = await cacheRepository.getValid("fmp", cacheKey);
    if (cached) {
      logger.info("FMP cache hit", { ticker, endpoint });
      return cached as T;
    }
  } catch (error) {
    logger.warn("Failed to check FMP cache, proceeding to API", { error });
  }

  // 2. Fetch from FMP API
  let apiKey: string;
  try {
    apiKey = getFmpApiKey();
  } catch (err) {
    throw new IntegrationError("FMP config error", "FMP", "FMP_API_KEY is not configured", false, undefined, err);
  }

  const queryParams = new URLSearchParams({ ...params, apikey: apiKey });
  const url = `${BASE_URL}/${endpoint}?${queryParams.toString()}`;

  const maxRetries = 2;
  let delay = 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000), // 8s timeout
      });

      if (response.status === 429) {
        if (attempt === maxRetries) {
          throw new RateLimitError("FMP", "Financial Modeling Prep rate limit exceeded");
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      if (!response.ok) {
        let errText = "";
        try {
          errText = await response.text();
        } catch (_) {}
        throw new IntegrationError("FMP HTTP error", "FMP", `HTTP error status ${response.status}: ${errText}`);
      }

      const text = await response.text();
      let data: T;
      try {
        data = JSON.parse(text) as T;
      } catch (err: unknown) {
        throw new IntegrationError("FMP parse error", "FMP", "Failed to parse JSON response from FMP API", false, undefined, err);
      }

      // 3. Write to cache
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours TTL
        await cacheRepository.set({
          id: generateId("run").replace("run_", "ch_"),
          provider: "fmp",
          cacheKey,
          requestFingerprint: cacheKey,
          payload: JSON.stringify(data),
          expiresAt,
        });
      } catch (cacheErr) {
        logger.warn("Failed to write FMP response to cache", { cacheErr });
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof RateLimitError || error instanceof IntegrationError) {
        throw error;
      }
      if (attempt === maxRetries) {
        throw new IntegrationError("FMP request failed", "FMP", error instanceof Error ? error.message : "Request failed", false, undefined, error);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  throw new IntegrationError("FMP fetch error", "FMP", "Unknown fetch error occurred");
}

export const fmpClient = {
  async getCompanyProfile(ticker: string) {
    const data = await fmpFetch<unknown[]>("profile", { symbol: ticker.toUpperCase() });
    if (!data || data.length === 0) {
      throw new IntegrationError("FMP profile error", "FMP", `No profile found for ticker ${ticker}`);
    }
    return data[0] as Record<string, unknown>;
  },

  async getIncomeStatements(ticker: string, limit = 3) {
    return fmpFetch<unknown[]>("income-statement", { symbol: ticker.toUpperCase(), period: "annual", limit: String(limit) });
  },

  async getBalanceSheets(ticker: string, limit = 3) {
    return fmpFetch<unknown[]>("balance-sheet-statement", { symbol: ticker.toUpperCase(), period: "annual", limit: String(limit) });
  },

  async getCashFlowStatements(ticker: string, limit = 3) {
    return fmpFetch<unknown[]>("cash-flow-statement", { symbol: ticker.toUpperCase(), period: "annual", limit: String(limit) });
  },

  async getKeyMetrics(ticker: string, limit = 3) {
    return fmpFetch<unknown[]>("key-metrics", { symbol: ticker.toUpperCase(), period: "annual", limit: String(limit) });
  },

  async getFinancialRatios(ticker: string, limit = 3) {
    return fmpFetch<unknown[]>("ratios", { symbol: ticker.toUpperCase(), period: "annual", limit: String(limit) });
  },

  async getQuote(ticker: string) {
    const data = await fmpFetch<unknown[]>("quote", { symbol: ticker.toUpperCase() });
    if (!data || data.length === 0) {
      throw new IntegrationError("FMP quote error", "FMP", `No quote found for ticker ${ticker}`);
    }
    return data[0] as Record<string, unknown>;
  },

  async search(query: string, limit = 10) {
    const [symbolRes, nameRes] = await Promise.allSettled([
      fmpFetch<any[]>("search-symbol", { query, limit: String(limit) }),
      fmpFetch<any[]>("search-name", { query, limit: String(limit) })
    ]);
    
    const symbols = symbolRes.status === "fulfilled" && Array.isArray(symbolRes.value) ? symbolRes.value : [];
    const names = nameRes.status === "fulfilled" && Array.isArray(nameRes.value) ? nameRes.value : [];
    
    const merged = new Map<string, any>();
    symbols.forEach((item) => {
      if (item && item.symbol) {
        merged.set(item.symbol.toUpperCase(), item);
      }
    });
    names.forEach((item) => {
      if (item && item.symbol) {
        const key = item.symbol.toUpperCase();
        if (!merged.has(key)) {
          merged.set(key, item);
        }
      }
    });
    
    return Array.from(merged.values());
  },
};
