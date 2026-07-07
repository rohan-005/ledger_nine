import "server-only";
import { fetchJson } from "./shared/fetchJson";
import { EndpointResult } from "./shared/types";
import { getFinnhubApiKey } from "@/src/lib/env";

const BASE_URL = "https://finnhub.io/api/v1";

const getApiKey = () => {
  try {
    return getFinnhubApiKey();
  } catch {
    return null;
  }
};

export const finnhubProvider = {
  name: "Finnhub",

  async search(query: string): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&token=${key}`;
    const result = await fetchJson({
      provider: "Finnhub",
      endpointName: "Search",
      url,
      query,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      if (Array.isArray(rawObj.result)) {
        result.response.data = rawObj.result.map((item: any) => ({
          symbol: item.symbol,
          name: item.description,
          type: item.type,
        }));
      }
    }
    return result;
  },

  async getProfile(symbol: string, candidatesTried: string[] = []): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${key}`;
    const result = await fetchJson({
      provider: "Finnhub",
      endpointName: "Profile",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      candidatesTried,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const p = result.response.raw as Record<string, any>;
      if (p.name) {
        result.response.data = {
          name: p.name,
          symbol: p.ticker,
          exchange: p.exchange,
          currency: p.currency,
          industry: p.finnhubIndustry,
          website: p.weburl,
          mcap: p.marketCapitalization,
          shareOutstanding: p.shareOutstanding,
        };
      } else {
        result.status = "empty";
        result.ok = false;
      }
    }
    return result;
  },

  async getQuote(symbol: string, candidatesTried: string[] = []): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
    const result = await fetchJson({
      provider: "Finnhub",
      endpointName: "Quote",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      candidatesTried,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const q = result.response.raw as Record<string, any>;
      // Finnhub returns open price 'o' which is > 0 or current price 'c' > 0
      if (q.c !== undefined && q.c !== 0) {
        result.response.data = {
          symbol,
          currentPrice: q.c,
          change: q.d,
          changePercent: q.dp,
          high: q.h,
          low: q.l,
          open: q.o,
          previousClose: q.pc,
        };
      } else {
        result.status = "empty";
        result.ok = false;
      }
    }
    return result;
  },

  async getBasicMetrics(symbol: string): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key}`;
    const result = await fetchJson({
      provider: "Finnhub",
      endpointName: "Basic Financials",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      if (rawObj.metric) {
        result.response.data = {
          peAnnual: rawObj.metric.peAnnual,
          pbAnnual: rawObj.metric.pbAnnual,
          epsGrowthYoy: rawObj.metric.epsGrowth3Y || rawObj.metric.epsGrowth5Y,
          tenDayAverageVolume: rawObj.metric["10DayAverageVolume"],
          fiftyTwoWeekHigh: rawObj.metric["52WeekHigh"],
          fiftyTwoWeekLow: rawObj.metric["52WeekLow"],
          roe: rawObj.metric.roeTTM,
        };
      }
    }
    return result;
  },

  async getPeers(symbol: string): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/stock/peers?symbol=${encodeURIComponent(symbol)}&token=${key}`;
    const result = await fetchJson({
      provider: "Finnhub",
      endpointName: "Peers",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw)) {
      result.response.data = result.response.raw;
    }
    return result;
  },

  async getCompanyNews(symbol: string): Promise<EndpointResult> {
    const key = getApiKey();
    
    // Last 30 days
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);

    const toStr = toDate.toISOString().split("T")[0];
    const fromStr = fromDate.toISOString().split("T")[0];

    const url = `${BASE_URL}/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromStr}&to=${toStr}&token=${key}`;
    const result = await fetchJson({
      provider: "Finnhub",
      endpointName: "Company News",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw)) {
      result.response.data = result.response.raw.slice(0, 10).map((item: any) => ({
        id: item.id,
        datetime: item.datetime,
        headline: item.headline,
        summary: item.summary,
        source: item.source,
        url: item.url,
      }));
    }
    return result;
  },
};
