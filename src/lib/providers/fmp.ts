import "server-only";
import { fetchJson } from "./shared/fetchJson";
import { EndpointResult } from "./shared/types";
import { getFmpApiKey } from "@/src/lib/env";

const BASE_URL = "https://financialmodelingprep.com/api/v3";

const getApiKey = () => {
  try {
    return getFmpApiKey();
  } catch {
    return null;
  }
};

export const fmpProvider = {
  name: "FMP",

  async search(query: string): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/search?query=${encodeURIComponent(query)}&limit=10&apikey=${key}`;
    const result = await fetchJson({
      provider: "FMP",
      endpointName: "Search",
      url,
      query,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw)) {
      result.response.data = result.response.raw.map((item: any) => ({
        symbol: item.symbol,
        name: item.name,
        exchange: item.exchangeShortName || item.stockExchange,
      }));
    }
    return result;
  },

  async getProfile(symbol: string, candidatesTried: string[] = []): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/profile/${encodeURIComponent(symbol)}?apikey=${key}`;
    const result = await fetchJson({
      provider: "FMP",
      endpointName: "Profile",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      candidatesTried,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw) && result.response.raw.length > 0) {
      const p = result.response.raw[0];
      result.response.data = {
        name: p.companyName,
        symbol: p.symbol,
        description: p.description,
        exchange: p.exchangeShortName,
        industry: p.industry,
        sector: p.sector,
        website: p.website,
        price: p.price,
        mcap: p.mcap,
        ceo: p.ceo,
      };
    } else if (result.ok) {
      result.status = "empty";
      result.ok = false;
    }
    return result;
  },

  async getQuote(symbol: string, candidatesTried: string[] = []): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/quote/${encodeURIComponent(symbol)}?apikey=${key}`;
    const result = await fetchJson({
      provider: "FMP",
      endpointName: "Quote",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      candidatesTried,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw) && result.response.raw.length > 0) {
      const q = result.response.raw[0];
      result.response.data = {
        symbol: q.symbol,
        price: q.price,
        change: q.change,
        changePercent: q.changesPercentage,
        volume: q.volume,
        dayLow: q.dayLow,
        dayHigh: q.dayHigh,
        yearLow: q.yearLow,
        yearHigh: q.yearHigh,
        pe: q.pe,
      };
    } else if (result.ok) {
      result.status = "empty";
      result.ok = false;
    }
    return result;
  },

  async getIncomeStatements(symbol: string, limit = 4): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/income-statement/${encodeURIComponent(symbol)}?period=annual&limit=${limit}&apikey=${key}`;
    const result = await fetchJson({
      provider: "FMP",
      endpointName: "Income Statement",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw)) {
      result.response.data = result.response.raw.map((item: any) => ({
        calendarYear: item.calendarYear,
        date: item.date,
        revenue: item.revenue,
        grossProfit: item.grossProfit,
        operatingIncome: item.operatingIncome,
        netIncome: item.netIncome,
        eps: item.eps,
        ebitda: item.ebitda,
      }));
    }
    return result;
  },

  async getBalanceSheets(symbol: string, limit = 4): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/balance-sheet-statement/${encodeURIComponent(symbol)}?period=annual&limit=${limit}&apikey=${key}`;
    const result = await fetchJson({
      provider: "FMP",
      endpointName: "Balance Sheet",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw)) {
      result.response.data = result.response.raw.map((item: any) => ({
        calendarYear: item.calendarYear,
        date: item.date,
        totalAssets: item.totalAssets,
        totalLiabilities: item.totalLiabilities,
        totalStockholdersEquity: item.totalStockholdersEquity,
        cashAndCashEquivalents: item.cashAndCashEquivalents,
        netDebt: item.netDebt,
      }));
    }
    return result;
  },

  async getCashFlowStatements(symbol: string, limit = 4): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/cash-flow-statement/${encodeURIComponent(symbol)}?period=annual&limit=${limit}&apikey=${key}`;
    const result = await fetchJson({
      provider: "FMP",
      endpointName: "Cash Flow",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw)) {
      result.response.data = result.response.raw.map((item: any) => ({
        calendarYear: item.calendarYear,
        date: item.date,
        netCashProvidedByOperatingActivities: item.netCashProvidedByOperatingActivities,
        capitalExpenditure: item.capitalExpenditure,
        freeCashFlow: item.freeCashFlow,
      }));
    }
    return result;
  },

  async getKeyMetrics(symbol: string, limit = 4): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/key-metrics/${encodeURIComponent(symbol)}?period=annual&limit=${limit}&apikey=${key}`;
    const result = await fetchJson({
      provider: "FMP",
      endpointName: "Key Metrics",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw)) {
      result.response.data = result.response.raw.map((item: any) => ({
        calendarYear: item.calendarYear,
        date: item.date,
        peRatio: item.peRatio,
        pfcfRatio: item.pfcfRatio,
        pbRatio: item.pbRatio,
        debtToEquity: item.debtToEquity,
        roe: item.roe,
        bookValuePerShare: item.bookValuePerShare,
      }));
    }
    return result;
  },

  async getFinancialRatios(symbol: string, limit = 4): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/ratios/${encodeURIComponent(symbol)}?period=annual&limit=${limit}&apikey=${key}`;
    const result = await fetchJson({
      provider: "FMP",
      endpointName: "Ratios",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw)) {
      result.response.data = result.response.raw.map((item: any) => ({
        calendarYear: item.calendarYear,
        date: item.date,
        currentRatio: item.currentRatio,
        quickRatio: item.quickRatio,
        grossProfitMargin: item.grossProfitMargin,
        operatingProfitMargin: item.operatingProfitMargin,
        netProfitMargin: item.netProfitMargin,
        returnOnAssets: item.returnOnAssets,
        returnOnEquity: item.returnOnEquity,
      }));
    }
    return result;
  },

  async getHistoricalPrice(symbol: string): Promise<EndpointResult> {
    const key = getApiKey();
    // Fetch last 30 historical daily prices
    const url = `${BASE_URL}/historical-price-full/${encodeURIComponent(symbol)}?timeseries=30&apikey=${key}`;
    const result = await fetchJson({
      provider: "FMP",
      endpointName: "Historical Price",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && result.response.raw && typeof result.response.raw === "object") {
      const rawObj = result.response.raw as Record<string, any>;
      if (Array.isArray(rawObj.historical)) {
        result.response.data = rawObj.historical.map((item: any) => ({
          date: item.date,
          close: item.close,
          volume: item.volume,
        }));
      }
    }
    return result;
  },

  async getPeers(symbol: string): Promise<EndpointResult> {
    const key = getApiKey();
    const url = `${BASE_URL}/stock_peers?symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
    const result = await fetchJson({
      provider: "FMP",
      endpointName: "Peers",
      url,
      symbolRequested: symbol,
      symbolUsed: symbol,
      apiKeyCheck: getApiKey,
    });

    if (result.ok && Array.isArray(result.response.raw) && result.response.raw.length > 0) {
      const rawObj = result.response.raw[0] as Record<string, any>;
      if (Array.isArray(rawObj.peers)) {
        result.response.data = rawObj.peers;
      }
    }
    return result;
  },
};
