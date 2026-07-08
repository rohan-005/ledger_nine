import "server-only";
import { fetchJson } from "./shared/fetchJson";
import { EndpointResult } from "./shared/types";
import { getSecEdgarUserAgent } from "@/src/lib/env";

const getHeaders = () => {
  try {
    return { "User-Agent": getSecEdgarUserAgent() };
  } catch {
    return { "User-Agent": "LedgerNineResearchPlatform/1.0" };
  }
};

export const secProvider = {
  name: "SEC EDGAR",

  async getCikFromTicker(symbol: string): Promise<string | null> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const headers = getHeaders();
    
    const result = await fetchJson({
      provider: "SEC EDGAR",
      endpointName: "Ticker Map",
      url: "https://www.sec.gov/files/company_tickers.json",
      headers,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      const match = Object.values(rawObj).find(
        (item: any) => item && item.ticker && item.ticker.toUpperCase() === cleanSymbol
      ) as any;
      if (match && match.cik_str !== undefined) {
        return String(match.cik_str).padStart(10, "0");
      }
    }
    return null;
  },

  async getSubmissions(symbol: string, candidatesTried: string[] = []): Promise<EndpointResult> {
    const startTimeStr = new Date().toISOString();
    const startTime = Date.now();
    const cik = await this.getCikFromTicker(symbol);
    if (!cik) {
      return {
        provider: "SEC EDGAR",
        endpointName: "Submissions",
        ok: false,
        status: "unsupported_symbol",
        startedAt: startTimeStr,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        httpStatus: null,
        request: {
          endpoint: "https://data.sec.gov/submissions/CIK{cik}.json",
          method: "GET",
          symbolRequested: symbol,
          symbolUsed: null,
          candidatesTried,
          query: null,
        },
        response: {
          recordCount: null,
          raw: null,
          data: null,
        },
        error: {
          code: "unsupported_symbol",
          message: `CIK not found for symbol ${symbol}`,
        },
      };
    }

    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const headers = getHeaders();

    const result = await fetchJson({
      provider: "SEC EDGAR",
      endpointName: "Submissions",
      url,
      headers,
      symbolRequested: symbol,
      symbolUsed: cik,
      candidatesTried,
      apiKeyCheck: () => "sec-edgar-agent",
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      result.response.data = {
        cik: rawObj.cik,
        entityType: rawObj.entityType,
        sic: rawObj.sic,
        name: rawObj.name,
        tickers: rawObj.tickers,
        exchanges: rawObj.exchanges,
        ein: rawObj.ein,
        description: rawObj.description,
        filings: rawObj.filings?.recent || null,
      };
    }

    return result;
  },

  async getCompanyFacts(symbol: string, candidatesTried: string[] = []): Promise<EndpointResult> {
    const startTimeStr = new Date().toISOString();
    const startTime = Date.now();
    const cik = await this.getCikFromTicker(symbol);
    if (!cik) {
      return {
        provider: "SEC EDGAR",
        endpointName: "Company Facts",
        ok: false,
        status: "unsupported_symbol",
        startedAt: startTimeStr,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        httpStatus: null,
        request: {
          endpoint: "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json",
          method: "GET",
          symbolRequested: symbol,
          symbolUsed: null,
          candidatesTried,
          query: null,
        },
        response: {
          recordCount: null,
          raw: null,
          data: null,
        },
        error: {
          code: "unsupported_symbol",
          message: `CIK not found for symbol ${symbol}`,
        },
      };
    }

    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
    const headers = getHeaders();

    const result = await fetchJson({
      provider: "SEC EDGAR",
      endpointName: "Company Facts",
      url,
      headers,
      symbolRequested: symbol,
      symbolUsed: cik,
      candidatesTried,
      apiKeyCheck: () => "sec-edgar-agent",
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      result.response.data = {
        cik: rawObj.cik,
        entityName: rawObj.entityName,
        facts: rawObj.facts || null,
      };
    }

    return result;
  },
};
