import "server-only";
import { EvidenceBundle } from "./buildEvidenceBundle";
import { CompanyMarketSnapshot, FundamentalPeriod, Article, WebContext, ProviderStatus, CompanyDetails, MarketData, HistoricalReturns } from "../../types/snapshot";

/**
 * Resolves conflicts across multiple API providers and compiles a clean, normalized CompanyMarketSnapshot.
 */
export function buildSnapshot(bundle: EvidenceBundle): CompanyMarketSnapshot {
  // Helper to extract a field from profiles in priority: FMP > EODHD > Finnhub
  const getProfileField = <T>(field: string, defaultValue: T): T => {
    // FMP profile
    const fmpProfile = bundle.companyProfiles.find(p => p.provider === "FMP")?.data as Record<string, any>;
    if (fmpProfile && fmpProfile[field] !== undefined && fmpProfile[field] !== null) {
      return fmpProfile[field] as T;
    }
    // EODHD profile / General
    const eodhdProfile = bundle.companyProfiles.find(p => p.provider === "EODHD")?.data as Record<string, any>;
    if (eodhdProfile) {
      if (eodhdProfile[field] !== undefined && eodhdProfile[field] !== null) {
        return eodhdProfile[field] as T;
      }
      if (eodhdProfile.General && eodhdProfile.General[field] !== undefined && eodhdProfile.General[field] !== null) {
        return eodhdProfile.General[field] as T;
      }
    }
    // Finnhub profile
    const finnhubProfile = bundle.companyProfiles.find(p => p.provider === "Finnhub")?.data as Record<string, any>;
    if (finnhubProfile && finnhubProfile[field] !== undefined && finnhubProfile[field] !== null) {
      return finnhubProfile[field] as T;
    }
    return defaultValue;
  };

  // Compile Company Details
  const company: CompanyDetails = {
    name: bundle.company.name,
    ticker: bundle.company.ticker,
    exchange: bundle.company.exchange || getProfileField("exchange", null),
    country: bundle.company.country || getProfileField("country", null) || getProfileField("countryName", null),
    sector: getProfileField("sector", null),
    industry: getProfileField("industry", null) || getProfileField("finnhubIndustry", null),
    description: getProfileField("description", null),
    currency: bundle.company.country === "India" ? "INR" : "USD",
  };

  // Compile Market Data (priority: FMP > EODHD > Twelve Data > Finnhub)
  let price: number | null = null;
  let change: number | null = null;
  let changePercent: number | null = null;
  let high: number | null = null;
  let low: number | null = null;
  let previousClose: number | null = null;
  let volume: number | null = null;
  let marketCap: number | null = null;
  let sharesOutstanding: number | null = null;
  let pe: number | null = null;
  let pb: number | null = null;
  let eps: number | null = null;

  // Find a quote from FMP
  const fmpQuote = bundle.quotes.find(q => q.provider === "FMP")?.data as Record<string, any>;
  const eodhdQuote = bundle.quotes.find(q => q.provider === "EODHD")?.data as Record<string, any>;
  const tdQuote = bundle.quotes.find(q => q.provider === "Twelve Data")?.data as Record<string, any>;
  const finnhubQuote = bundle.quotes.find(q => q.provider === "Finnhub")?.data as Record<string, any>;

  const selectQuote = () => {
    if (fmpQuote) return { q: fmpQuote, p: "FMP" };
    if (eodhdQuote) return { q: eodhdQuote, p: "EODHD" };
    if (tdQuote) return { q: tdQuote, p: "Twelve Data" };
    if (finnhubQuote) return { q: finnhubQuote, p: "Finnhub" };
    return null;
  };

  const selected = selectQuote();
  if (selected) {
    const q = selected.q;
    const p = selected.p;
    
    price = parseFloat(q.price || q.close || q.currentPrice || 0) || null;
    change = parseFloat(q.change || 0) || null;
    changePercent = parseFloat(q.changePercent || q.changesPercentage || q.percent_change || 0) || null;
    high = parseFloat(q.high || q.dayHigh || q.day_high || 0) || null;
    low = parseFloat(q.low || q.dayLow || q.day_low || 0) || null;
    previousClose = parseFloat(q.previousClose || q.prevClose || q.previous_close || 0) || null;
    volume = parseFloat(q.volume || 0) || null;
    marketCap = parseFloat(q.marketCap || q.mcap || q.market_cap || 0) || null;
    sharesOutstanding = parseFloat(q.sharesOutstanding || q.sharesOutstandingTotal || 0) || null;
    pe = parseFloat(q.pe || q.peRatio || q.p_e || 0) || null;
  }

  // Fallback PE/PB/EPS if not in quote (from metrics / ratios)
  const fmpMetrics = bundle.metrics.find(m => m.provider === "FMP")?.data as Record<string, any>[];
  const fmpRatios = bundle.ratios.find(r => r.provider === "FMP")?.data as Record<string, any>[];

  if (Array.isArray(fmpMetrics) && fmpMetrics.length > 0) {
    const latestMetric = fmpMetrics[0];
    if (pe === null) pe = parseFloat(latestMetric.peRatio || 0) || null;
    if (pb === null) pb = parseFloat(latestMetric.pbRatio || 0) || null;
  }
  if (Array.isArray(fmpRatios) && fmpRatios.length > 0) {
    const latestRatio = fmpRatios[0];
    if (pb === null) pb = parseFloat(latestRatio.pbRatio || 0) || null;
  }

  // EODHD metrics fallback
  const eodhdFundamentals = bundle.companyProfiles.find(p => p.provider === "EODHD")?.data as Record<string, any>;
  if (eodhdFundamentals && eodhdFundamentals.Valuation) {
    const v = eodhdFundamentals.Valuation;
    if (pe === null) pe = parseFloat(v.TrailingPE || v.ForwardPE || 0) || null;
    if (pb === null) pb = parseFloat(v.PriceBookMRQ || 0) || null;
  }
  if (eodhdFundamentals && eodhdFundamentals.Highlights) {
    const h = eodhdFundamentals.Highlights;
    if (marketCap === null) marketCap = parseFloat(h.MarketCapitalization || 0) || null;
    if (eps === null) eps = parseFloat(h.DilutedEpsTD || h.EPSTrailingTwelveMonths || 0) || null;
  }

  // Finnhub basic metrics fallback
  const finnhubMetrics = bundle.metrics.find(m => m.provider === "Finnhub")?.data as Record<string, any>;
  if (finnhubMetrics && finnhubMetrics.metric) {
    const m = finnhubMetrics.metric;
    if (pe === null) pe = parseFloat(m["peNormalized"] || m["peTTM"] || 0) || null;
    if (pb === null) pb = parseFloat(m["pbAnnual"] || m["pbQuarterly"] || 0) || null;
    if (marketCap === null) marketCap = parseFloat(m["marketCapitalization"] || 0) * 1000000 || null; // Finnhub in Millions
  }

  const market: MarketData = {
    price,
    change,
    changePercent,
    high,
    low,
    previousClose,
    volume,
    marketCap,
    sharesOutstanding,
    pe,
    pb,
    eps,
  };

  // Compile Historical Returns
  let return30dPercent: number | null = null;
  let historyLength = 0;

  const fmpHistory = bundle.historicalPrices.find(h => h.provider === "FMP")?.data as Record<string, any>[];
  const tdHistory = bundle.historicalPrices.find(h => h.provider === "Twelve Data")?.data as Record<string, any>[];
  const eodhdHistory = bundle.historicalPrices.find(h => h.provider === "EODHD")?.data as Record<string, any>[];

  const selectedHistory = fmpHistory || tdHistory || eodhdHistory;
  if (Array.isArray(selectedHistory) && selectedHistory.length > 1) {
    historyLength = selectedHistory.length;
    // History usually sorted newest to oldest or vice-versa. Let's make sure.
    const prices = selectedHistory.map(item => parseFloat(item.close || item.price || 0)).filter(p => p > 0);
    if (prices.length > 1) {
      // Find oldest and newest
      const newest = prices[0];
      const oldest = prices[prices.length - 1];
      if (oldest > 0) {
        return30dPercent = ((newest - oldest) / oldest) * 100;
      }
    }
  }

  const history: HistoricalReturns = {
    return30dPercent,
    historyLength,
  };

  // Compile Fundamentals (last 3 years)
  const financialsMap: Record<number, Partial<FundamentalPeriod>> = {};

  const addStatementData = (stmtList: any[], type: "income" | "balance" | "cashflow") => {
    if (!Array.isArray(stmtList)) return;
    for (const item of stmtList) {
      const yearStr = item.calendarYear || item.date?.substring(0, 4) || item.year;
      const year = parseInt(yearStr);
      if (isNaN(year)) continue;

      if (!financialsMap[year]) {
        financialsMap[year] = { year };
      }

      const f = financialsMap[year];
      if (type === "income") {
        f.revenue = parseFloat(item.revenue || item.totalRevenue || 0) || f.revenue || null;
        f.netIncome = parseFloat(item.netIncome || item.net_income || 0) || f.netIncome || null;
      } else if (type === "balance") {
        f.totalAssets = parseFloat(item.totalAssets || 0) || f.totalAssets || null;
        f.totalLiabilities = parseFloat(item.totalLiabilities || 0) || f.totalLiabilities || null;
      } else if (type === "cashflow") {
        f.operatingCashFlow = parseFloat(item.operatingCashFlow || item.netCashProvidedByOperatingActivities || 0) || f.operatingCashFlow || null;
        f.freeCashFlow = parseFloat(item.freeCashFlow || 0) || f.freeCashFlow || null;
      }
    }
  };

  // FMP statement collections
  const fmpIncome = bundle.financialStatements.find(s => s.provider === "FMP" && s.endpoint.includes("Income"))?.data as any[];
  const fmpBalance = bundle.financialStatements.find(s => s.provider === "FMP" && s.endpoint.includes("Balance"))?.data as any[];
  const fmpCashFlow = bundle.financialStatements.find(s => s.provider === "FMP" && s.endpoint.includes("Cash"))?.data as any[];

  addStatementData(fmpIncome, "income");
  addStatementData(fmpBalance, "balance");
  addStatementData(fmpCashFlow, "cashflow");

  // EODHD statement collections
  const eodhdIncome = bundle.financialStatements.find(s => s.provider === "EODHD" && s.endpoint.includes("Income"))?.data as any[];
  const eodhdBalance = bundle.financialStatements.find(s => s.provider === "EODHD" && s.endpoint.includes("Balance"))?.data as any[];
  const eodhdCashFlow = bundle.financialStatements.find(s => s.provider === "EODHD" && s.endpoint.includes("Cash"))?.data as any[];

  addStatementData(eodhdIncome, "income");
  addStatementData(eodhdBalance, "balance");
  addStatementData(eodhdCashFlow, "cashflow");

  // Fill Metrics like Debt to Equity, ROE per year
  for (const year of Object.keys(financialsMap).map(Number)) {
    const f = financialsMap[year];
    // ROE calculation or retrieval
    // Try FMP metrics or ratios first
    const metricItem = fmpMetrics?.find(m => parseInt(m.calendarYear) === year);
    const ratioItem = fmpRatios?.find(r => parseInt(r.calendarYear) === year);

    if (metricItem) {
      f.debtToEquity = parseFloat(metricItem.debtToEquity || 0) || null;
      f.roe = parseFloat(metricItem.roe || 0) || null;
    }
    if (ratioItem && f.roe === null) {
      f.roe = parseFloat(ratioItem.returnOnEquity || 0) || null;
    }

    // Mathematical Fallback for ROE: netIncome / (totalAssets - totalLiabilities)
    if (f.roe === null && f.netIncome !== null && f.netIncome !== undefined && f.totalAssets && f.totalLiabilities) {
      const equity = f.totalAssets - f.totalLiabilities;
      if (equity > 0) {
        f.roe = f.netIncome / equity;
      }
    }

    // Mathematical Fallback for Debt to Equity: totalLiabilities / (totalAssets - totalLiabilities)
    if (f.debtToEquity === null && f.totalAssets && f.totalLiabilities) {
      const equity = f.totalAssets - f.totalLiabilities;
      if (equity > 0) {
        f.debtToEquity = f.totalLiabilities / equity;
      }
    }
  }

  // Sort by year descending and limit to 3 periods
  const financials: FundamentalPeriod[] = Object.values(financialsMap)
    .sort((a, b) => (b.year || 0) - (a.year || 0))
    .slice(0, 3)
    .map(f => ({
      year: f.year || 0,
      revenue: f.revenue || null,
      netIncome: f.netIncome || null,
      operatingCashFlow: f.operatingCashFlow || null,
      freeCashFlow: f.freeCashFlow || null,
      totalAssets: f.totalAssets || null,
      totalLiabilities: f.totalLiabilities || null,
      debtToEquity: f.debtToEquity || null,
      roe: f.roe || null,
    }));

  // Compile News Context
  const news: Article[] = [];
  for (const n of bundle.news) {
    const rawList = Array.isArray(n.data) ? n.data : [n.data];
    for (const item of rawList) {
      if (!item) continue;
      news.push({
        title: item.title || item.headline || "News Article",
        date: item.date || item.datetime || item.publishedAt || item.time || null,
        source: item.source || item.sourceName || n.provider,
        summary: item.summary || item.description || null,
        url: item.url || null,
      });
    }
  }

  // Compile Web Context
  let answer: string | null = null;
  const webResults: { title: string; url: string; content: string }[] = [];

  const tavilyData = bundle.webResearch.find(w => w.provider === "Tavily")?.data as Record<string, any>;
  if (tavilyData) {
    answer = tavilyData.answer || null;
    if (Array.isArray(tavilyData.results)) {
      for (const res of tavilyData.results) {
        webResults.push({
          title: res.title || "Web Search Result",
          url: res.url || "",
          content: res.content || "",
        });
      }
    }
  }

  const web: WebContext = {
    answer,
    results: webResults.slice(0, 5),
  };

  // Compile Provider Endpoint Statuses
  const providerNames = ["FMP", "Finnhub", "Twelve Data", "EODHD", "NewsAPI", "Tavily", "Alpha Vantage"];
  const providers: ProviderStatus[] = providerNames.map(provider => {
    // Find all results matching this provider
    const results = bundle.quotes.concat(
      bundle.companyProfiles,
      bundle.financialStatements,
      bundle.metrics,
      bundle.ratios,
      bundle.historicalPrices,
      bundle.news,
      bundle.webResearch
    ).filter(item => item.provider === provider);

    const failures = bundle.providerFailures.filter(f => f.provider === provider);

    const endpoints = results.map(r => ({
      name: r.endpoint,
      ok: true,
      status: "success",
      error: null as string | null,
    })).concat(
      failures.map(f => ({
        name: f.endpoint,
        ok: false,
        status: f.status,
        error: f.error,
      }))
    );

    // Determine status
    let status: ProviderStatus["status"] = "success";
    const healthVal = bundle.providerHealth[provider] || "success";
    
    if (healthVal === "auth_error") status = "auth_error";
    else if (healthVal === "rate_limit") status = "rate_limit";
    else if (healthVal === "unsupported") status = "unsupported";
    else if (healthVal === "plan_limited" || healthVal === "plan_limit") status = "plan_limited";
    else if (endpoints.length === 0) status = "empty";
    else if (endpoints.some(e => !e.ok)) {
      const isAuth = endpoints.some(e => e.status === "auth_error");
      const isRate = endpoints.some(e => e.status === "rate_limit");
      const isPlan = endpoints.some(e => e.status === "plan_limited" || e.status === "plan_limit");
      if (isAuth) status = "auth_error";
      else if (isRate) status = "rate_limit";
      else if (isPlan) status = "plan_limited";
      else status = "partial";
    }

    return {
      provider,
      status,
      endpoints,
    };
  });

  return {
    company,
    market,
    history,
    financials,
    news: news.slice(0, 10),
    web,
    providers,
  };
}
