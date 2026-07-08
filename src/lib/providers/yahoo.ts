import "server-only";
import { EndpointResult, ProviderEndpointStatus } from "./shared/types";
import YahooFinance from "yahoo-finance2";

// Initialize the YahooFinance instance with options to suppress notices
const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

interface CacheEntry {
  result: EndpointResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): EndpointResult | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    // Return a copy so mutations don't affect cache
    return JSON.parse(JSON.stringify(entry.result));
  }
  return null;
}

function setCached(key: string, result: EndpointResult, ttlMs: number) {
  cache.set(key, {
    result: JSON.parse(JSON.stringify(result)),
    expiresAt: Date.now() + ttlMs,
  });
}

function classifyError(err: any): { status: ProviderEndpointStatus; code: string; message: string } {
  const message = err.message || String(err);
  let status: ProviderEndpointStatus = "provider_error";
  let code = "YAHOO_ERROR";

  if (message.includes("rate") || message.includes("429") || err.status === 429) {
    status = "rate_limit";
    code = "RATE_LIMIT";
  } else if (message.includes("auth") || message.includes("401") || message.includes("unauthorized") || err.status === 401) {
    status = "auth_error";
    code = "AUTH_ERROR";
  } else if (message.includes("NotFound") || message.includes("not found") || message.includes("404") || err.status === 404) {
    status = "unsupported_symbol";
    code = "NOT_FOUND";
  } else if (message.includes("timeout")) {
    status = "timeout";
    code = "TIMEOUT";
  }

  return { status, code, message };
}

export const yahooProvider = {
  name: "Yahoo Finance",

  async search(query: string): Promise<EndpointResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const cacheKey = `search:${query.toLowerCase().trim()}`;

    const cached = getCached(cacheKey);
    if (cached) {
      cached.startedAt = startedAt;
      cached.completedAt = new Date().toISOString();
      cached.durationMs = Date.now() - startTime;
      return cached;
    }

    const result: EndpointResult = {
      provider: "Yahoo Finance",
      endpointName: "Search",
      status: "success",
      ok: true,
      startedAt,
      completedAt: startedAt,
      durationMs: 0,
      httpStatus: 200,
      request: {
        endpoint: "Search",
        method: "GET",
        symbolRequested: null,
        symbolUsed: null,
        candidatesTried: [],
        query,
      },
      response: {
        recordCount: null,
        data: null,
        raw: null,
      },
      error: null,
    };

    try {
      const searchRes = await yf.search(query);
      result.response.raw = searchRes;
      
      const quotes = searchRes.quotes || [];
      result.response.recordCount = quotes.length;
      result.response.data = quotes.map((item: any) => ({
        symbol: item.symbol,
        name: item.longname || item.shortname || item.name,
        exchange: item.exchange,
        type: item.quoteType,
      }));

      result.completedAt = new Date().toISOString();
      result.durationMs = Date.now() - startTime;

      // Cache search results for 12 hours (12 * 60 * 60 * 1000 = 43200000 ms)
      setCached(cacheKey, result, 43200000);
      return result;
    } catch (err: any) {
      const errInfo = classifyError(err);
      result.ok = false;
      result.status = errInfo.status;
      result.error = { code: errInfo.code, message: errInfo.message };
      result.completedAt = new Date().toISOString();
      result.durationMs = Date.now() - startTime;
      return result;
    }
  },

  async getQuote(symbol: string, candidatesTried: string[] = []): Promise<EndpointResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const cacheKey = `quote:${symbol.toUpperCase().trim()}`;

    const cached = getCached(cacheKey);
    if (cached) {
      cached.startedAt = startedAt;
      cached.completedAt = new Date().toISOString();
      cached.durationMs = Date.now() - startTime;
      return cached;
    }

    const result: EndpointResult = {
      provider: "Yahoo Finance",
      endpointName: "Quote",
      status: "success",
      ok: true,
      startedAt,
      completedAt: startedAt,
      durationMs: 0,
      httpStatus: 200,
      request: {
        endpoint: "Quote",
        method: "GET",
        symbolRequested: symbol,
        symbolUsed: symbol,
        candidatesTried,
        query: null,
      },
      response: {
        recordCount: null,
        data: null,
        raw: null,
      },
      error: null,
    };

    try {
      const quoteRes = await yf.quote(symbol);
      result.response.raw = quoteRes;
      
      if (quoteRes && quoteRes.regularMarketPrice !== undefined) {
        result.response.data = {
          symbol: quoteRes.symbol,
          name: quoteRes.longName || quoteRes.shortName,
          price: quoteRes.regularMarketPrice,
          change: quoteRes.regularMarketChange,
          changePercent: quoteRes.regularMarketChangePercent,
          volume: quoteRes.regularMarketVolume,
          dayHigh: quoteRes.regularMarketDayHigh,
          dayLow: quoteRes.regularMarketDayLow,
          fiftyTwoWeekHigh: quoteRes.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: quoteRes.fiftyTwoWeekLow,
          marketCap: quoteRes.marketCap,
          sharesOutstanding: quoteRes.sharesOutstanding,
          currency: quoteRes.currency,
          exchange: quoteRes.exchange,
        };
      } else {
        result.ok = false;
        result.status = "empty";
      }

      result.completedAt = new Date().toISOString();
      result.durationMs = Date.now() - startTime;

      if (result.ok) {
        // Cache quote for 2 minutes (2 * 60 * 1000 = 120000 ms)
        setCached(cacheKey, result, 120000);
      }
      return result;
    } catch (err: any) {
      const errInfo = classifyError(err);
      result.ok = false;
      result.status = errInfo.status;
      result.error = { code: errInfo.code, message: errInfo.message };
      result.completedAt = new Date().toISOString();
      result.durationMs = Date.now() - startTime;
      return result;
    }
  },

  async getChart(
    symbol: string,
    period1: Date,
    period2: Date,
    candidatesTried: string[] = []
  ): Promise<EndpointResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const cacheKey = `chart:${symbol.toUpperCase().trim()}:${period1.getTime()}:${period2.getTime()}`;

    const cached = getCached(cacheKey);
    if (cached) {
      cached.startedAt = startedAt;
      cached.completedAt = new Date().toISOString();
      cached.durationMs = Date.now() - startTime;
      return cached;
    }

    const result: EndpointResult = {
      provider: "Yahoo Finance",
      endpointName: "Chart",
      status: "success",
      ok: true,
      startedAt,
      completedAt: startedAt,
      durationMs: 0,
      httpStatus: 200,
      request: {
        endpoint: "Chart",
        method: "GET",
        symbolRequested: symbol,
        symbolUsed: symbol,
        candidatesTried,
        query: null,
      },
      response: {
        recordCount: null,
        data: null,
        raw: null,
      },
      error: null,
    };

    try {
      const chartRes = await yf.chart(symbol, {
        period1,
        period2,
        interval: "1d",
      });
      result.response.raw = chartRes;

      const quotes = chartRes.quotes || [];
      result.response.recordCount = quotes.length;
      result.response.data = quotes.map((item: any) => ({
        date: item.date instanceof Date ? item.date.toISOString().split("T")[0] : String(item.date).split("T")[0],
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));

      result.completedAt = new Date().toISOString();
      result.durationMs = Date.now() - startTime;

      if (result.ok) {
        // Cache historical chart for 1 hour (60 * 60 * 1000 = 3600000 ms)
        setCached(cacheKey, result, 3600000);
      }
      return result;
    } catch (err: any) {
      const errInfo = classifyError(err);
      result.ok = false;
      result.status = errInfo.status;
      result.error = { code: errInfo.code, message: errInfo.message };
      result.completedAt = new Date().toISOString();
      result.durationMs = Date.now() - startTime;
      return result;
    }
  },
};
