import { EndpointResult, ProviderEndpointStatus } from "../lib/providers/shared/types";

export interface CompanyDetails {
  name: string;
  ticker: string;
  exchange: string | null;
  country: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  currency: string | null;
}

export interface MarketData {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  volume: number | null;
  marketCap: number | null;
  sharesOutstanding: number | null;
  pe: number | null;
  pb: number | null;
  eps: number | null;
}

export interface HistoricalReturns {
  return30dPercent: number | null;
  historyLength: number;
}

export interface FundamentalPeriod {
  year: number;
  revenue: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  debtToEquity: number | null;
  roe: number | null;
}

export interface Article {
  title: string;
  date: string | null;
  source: string | null;
  summary: string | null;
  url: string | null;
}

export interface WebContext {
  answer: string | null;
  results: { title: string; url: string; content: string }[];
}

export interface ProviderStatus {
  provider: string;
  status: ProviderEndpointStatus;
  endpoints: { name: string; ok: boolean; status: string; error: string | null }[];
}

export interface CompanyMarketSnapshot {
  company: CompanyDetails;
  market: MarketData;
  history: HistoricalReturns;
  financials: FundamentalPeriod[];
  news: Article[];
  web: WebContext;
  providers: ProviderStatus[];
}

export interface SignalsBreakdown {
  priceMomentum: number; // 0-100
  valuation: number; // 0-100
  financialQuality: number; // 0-100
  newsContext: number; // 0-100
  dataConfidence: number; // 0-100
  finalDeterministicScore: number; // 0-100
  deterministicVerdict: "INVEST" | "WATCH" | "PASS";
}
