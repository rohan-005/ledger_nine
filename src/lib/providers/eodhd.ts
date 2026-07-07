import "server-only";
import { fetchJson } from "./shared/fetchJson";
import { EndpointResult } from "./shared/types";
import { getEodhdApiKey } from "@/src/lib/env";

const BASE_URL = "https://eodhd.com/api";

const getApiKey = () => {
  try {
    return getEodhdApiKey();
  } catch {
    return null;
  }
};

export const eodhdProvider = {
  name: "EODHD",

  async search(query: string): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/search/${encodeURIComponent(query)}?api_token=${key}&fmt=json&limit=10`;
    const result = await fetchJson({
      provider: "EODHD",
      endpointName: "Search",
      url,
      query,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw)) {
      result.response.data = result.response.raw.map((item: any) => ({
        symbol: item.Code,
        exchange: item.Exchange,
        name: item.Name,
        type: item.Type,
      }));
    }
    return result;
  },

  async getQuote(symbol: string, candidatesTried: string[] = []): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/real-time/${encodeURIComponent(symbol)}?fmt=json&api_token=${key}`;
    const result = await fetchJson({
      provider: "EODHD",
      endpointName: "Quote",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      candidatesTried,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const q = result.response.raw as Record<string, any>;
      // EODHD quote returns symbol code and close price
      if (q.code && q.close !== undefined) {
        result.response.data = {
          symbol: q.code,
          price: q.close,
          change: q.change,
          changePercent: q.change_p,
          volume: q.volume,
          timestamp: q.timestamp,
        };
      } else {
        result.status = "empty";
        result.ok = false;
      }
    }
    return result;
  },

  async getEodHistory(symbol: string): Promise<EndpointResult> {
    const key = getApiKey();
    
    // Last 30 days
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const toStr = toDate.toISOString().split("T")[0];
    const fromStr = fromDate.toISOString().split("T")[0];

    const url = `${BASE_URL}/eod/${encodeURIComponent(symbol)}?from=${fromStr}&to=${toStr}&fmt=json&api_token=${key}`;
    const result = await fetchJson({
      provider: "EODHD",
      endpointName: "EOD History",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw)) {
      result.response.data = result.response.raw.map((item: any) => ({
        date: item.date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));
    }
    return result;
  },

  async getFundamentals(symbol: string): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/fundamentals/${encodeURIComponent(symbol)}?fmt=json&api_token=${key}`;
    const result = await fetchJson({
      provider: "EODHD",
      endpointName: "Fundamentals",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const f = result.response.raw as Record<string, any>;
      if (f.General) {
        result.response.data = {
          name: f.General.Name,
          sector: f.General.Sector,
          industry: f.General.Industry,
          description: f.General.Description,
          employees: f.General.FullTimeEmployees,
          valuation: f.Valuation || null,
          sharesStats: f.SharesStats || null,
          financials: f.Financials || null,
        };
      }
    }
    return result;
  },
};
