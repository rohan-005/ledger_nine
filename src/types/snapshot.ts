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

export interface CategoryAssessments {
  priceHistory: {
    status: "sufficient" | "insufficient" | "unavailable";
    daysCount: number;
    reason: string;
  };
  financialCapacity: {
    status: "strong" | "moderate" | "weak" | "unavailable";
    reason: string;
  };
  cashFlow: {
    status: "positive" | "mixed" | "negative" | "unavailable";
    reason: string;
  };
  news: {
    status: "positive" | "negative" | "mixed" | "neutral" | "unavailable";
    reason: string;
  };
  marketValue: {
    status: "valued" | "unavailable";
    marketCap: number | null;
    reason: string;
  };
}

export interface CompanyMarketSnapshot {
  company: CompanyDetails;
  market: MarketData;
  history: HistoricalReturns;
  financials: FundamentalPeriod[];
  news: Article[];
  web: WebContext;
  providers: ProviderStatus[];
  categoryAssessments: CategoryAssessments;
  provenance?: Record<string, string>;
}
