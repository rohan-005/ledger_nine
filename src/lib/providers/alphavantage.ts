import "server-only";
import { fetchJson } from "./shared/fetchJson";
import { EndpointResult } from "./shared/types";
import { getAlphaVantageApiKey } from "@/src/lib/env";

const BASE_URL = "https://www.alphavantage.co/query";

const getApiKey = () => {
  try {
    return getAlphaVantageApiKey();
  } catch {
    return null;
  }
};

export const alphaVantageProvider = {
  name: "Alpha Vantage",

  async search(query: string): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${key}`;
    const result = await fetchJson({
      provider: "Alpha Vantage",
      endpointName: "Search",
      url,
      query,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      if (Array.isArray(rawObj.bestMatches)) {
        result.response.data = rawObj.bestMatches.map((item: any) => ({
          symbol: item["1. symbol"],
          name: item["2. name"],
          type: item["3. type"],
          region: item["4. region"],
        }));
      } else if (rawObj.Note || rawObj.Information) {
        result.status = "rate_limit";
        result.ok = false;
        result.error = {
          code: "RATE_LIMIT",
          message: rawObj.Note || rawObj.Information || "Alpha Vantage rate limit reached",
        };
      }
    }
    return result;
  },

  async getQuote(
    symbol: string,
    candidatesTried: string[] = []
  ): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
    const result = await fetchJson({
      provider: "Alpha Vantage",
      endpointName: "Quote",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      candidatesTried,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      const q = rawObj["Global Quote"];
      if (q && q["01. symbol"]) {
        result.response.data = {
          symbol: q["01. symbol"],
          open: q["02. open"],
          high: q["03. high"],
          low: q["04. low"],
          price: q["05. price"],
          volume: q["06. volume"],
          latestDay: q["07. latest trading day"],
          prevClose: q["08. previous close"],
          change: q["09. change"],
          changePercent: q["10. change percent"],
        };
      } else if (rawObj.Note || rawObj.Information) {
        result.status = "rate_limit";
        result.ok = false;
        result.error = {
          code: "RATE_LIMIT",
          message: rawObj.Note || rawObj.Information || "Alpha Vantage rate limit reached",
        };
      } else {
        result.status = "empty";
        result.ok = false;
      }
    }
    return result;
  },

  async getTimeSeries(
    symbol: string
  ): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
    const result = await fetchJson({
      provider: "Alpha Vantage",
      endpointName: "Time Series",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      const timeSeries = rawObj["Time Series (Daily)"];
      if (timeSeries && typeof timeSeries === "object") {
        const entries = Object.entries(timeSeries).slice(0, 30);
        result.response.data = entries.map(([date, values]: [string, any]) => ({
          date,
          open: values["1. open"],
          high: values["2. high"],
          low: values["3. low"],
          close: values["4. close"],
          volume: values["5. volume"],
        }));
      } else if (rawObj.Note || rawObj.Information) {
        result.status = "rate_limit";
        result.ok = false;
        result.error = {
          code: "RATE_LIMIT",
          message: rawObj.Note || rawObj.Information || "Alpha Vantage rate limit reached",
        };
      } else {
        result.status = "empty";
        result.ok = false;
      }
    }
    return result;
  },
};
