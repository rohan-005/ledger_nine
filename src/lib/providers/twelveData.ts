import "server-only";
import { fetchJson } from "./shared/fetchJson";
import { EndpointResult } from "./shared/types";
import { getTwelveDataApiKey } from "@/src/lib/env";

const BASE_URL = "https://api.twelvedata.com";

const getApiKey = () => {
  try {
    return getTwelveDataApiKey();
  } catch {
    return null;
  }
};

export const twelveDataProvider = {
  name: "Twelve Data",

  async search(query: string): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${key}`;
    const result = await fetchJson({
      provider: "Twelve Data",
      endpointName: "Search",
      url,
      query,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      if (Array.isArray(rawObj.data)) {
        result.response.data = rawObj.data.map((item: any) => ({
          symbol: item.symbol,
          name: item.instrument_name,
          exchange: item.exchange,
          country: item.country,
        }));
      }
    }
    return result;
  },

  async getQuote(
    symbol: string,
    exchange?: string | null,
    candidatesTried: string[] = []
  ): Promise<EndpointResult> {
    const key = getApiKey();
    // Parse symbol if it contains colon e.g. RELIANCE:NSE
    let cleanSymbol = symbol;
    let exchangeParam = exchange || "";
    if (symbol.includes(":")) {
      const parts = symbol.split(":");
      cleanSymbol = parts[0];
      exchangeParam = parts[1];
    }

    let url = `${BASE_URL}/quote?symbol=${encodeURIComponent(cleanSymbol)}&apikey=${key}`;
    if (exchangeParam) {
      url += `&exchange=${encodeURIComponent(exchangeParam)}`;
    }

    const result = await fetchJson({
      provider: "Twelve Data",
      endpointName: "Quote",
      url,
      symbolRequested: symbol,
      symbolUsed: cleanSymbol,
      candidatesTried,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const q = result.response.raw as Record<string, any>;
      if (q.symbol && q.price) {
        result.response.data = {
          symbol: q.symbol,
          name: q.name,
          price: q.price,
          change: q.change,
          changePercent: q.percent_change,
          volume: q.volume,
          dayLow: q.low,
          dayHigh: q.high,
          fiftyTwoWeekLow: q.fifty_two_week?.low,
          fiftyTwoWeekHigh: q.fifty_two_week?.high,
        };
      } else {
        result.status = "empty";
        result.ok = false;
      }
    }
    return result;
  },

  async getTimeSeries(
    symbol: string,
    exchange?: string | null,
    outputsize = 30
  ): Promise<EndpointResult> {
    const key = getApiKey();
    let cleanSymbol = symbol;
    let exchangeParam = exchange || "";
    if (symbol.includes(":")) {
      const parts = symbol.split(":");
      cleanSymbol = parts[0];
      exchangeParam = parts[1];
    }

    let url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(cleanSymbol)}&interval=1day&outputsize=${outputsize}&apikey=${key}`;
    if (exchangeParam) {
      url += `&exchange=${encodeURIComponent(exchangeParam)}`;
    }

    const result = await fetchJson({
      provider: "Twelve Data",
      endpointName: "Time Series",
      url,
      symbolRequested: symbol,
      symbolUsed: cleanSymbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      if (Array.isArray(rawObj.values)) {
        result.response.data = rawObj.values.map((item: any) => ({
          date: item.datetime,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume,
        }));
      } else {
        // Twelve Data can return error status in body with 200 OK
        if (rawObj.status === "error") {
          result.status = "unsupported";
          result.ok = false;
          result.error = {
            code: "UNSUPPORTED",
            message: rawObj.message || "Twelve Data error in body response",
          };
        }
      }
    }
    return result;
  },
};
