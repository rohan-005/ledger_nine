import "server-only";
import { EvidenceBundle } from "./buildEvidenceBundle";
import { CompanyMarketSnapshot, FundamentalPeriod, Article, WebContext, ProviderStatus, CompanyDetails, MarketData, HistoricalReturns } from "../../types/snapshot";

/**
 * Parses SEC facts for a list of GAAP concepts, returning the value for a specific fiscal year.
 */
function getSecFactValue(factsObj: any, keys: string[], year: number): number | null {
  if (!factsObj || !factsObj.facts || !factsObj.facts["us-gaap"]) return null;
  const usGaap = factsObj.facts["us-gaap"];
  
  for (const key of keys) {
    const fact = usGaap[key];
    if (fact && fact.units) {
      for (const unitKey of Object.keys(fact.units)) {
        const list = fact.units[unitKey];
        if (Array.isArray(list)) {
          // 1. Look for annual FY data (form 10-K preferred) matching the year
          const matches10K = list.filter(
            (item: any) => item && item.fy === year && item.fp === "FY" && item.form === "10-K"
          );
          if (matches10K.length > 0) {
            const sorted = matches10K.sort((a: any, b: any) => new Date(b.filed).getTime() - new Date(a.filed).getTime());
            return sorted[0].val;
          }

          // 2. Fallback to any FY data matching the year
          const matchesFY = list.filter((item: any) => item && item.fy === year && item.fp === "FY");
          if (matchesFY.length > 0) {
            const sorted = matchesFY.sort((a: any, b: any) => new Date(b.filed).getTime() - new Date(a.filed).getTime());
            return sorted[0].val;
          }

          // 3. Fallback to any data matching the year
          const matchesYear = list.filter((item: any) => item && item.fy === year);
          if (matchesYear.length > 0) {
            const sorted = matchesYear.sort((a: any, b: any) => new Date(b.filed).getTime() - new Date(a.filed).getTime());
            return sorted[0].val;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Extracts all fiscal years available in SEC facts.
 */
function getSecFactYears(factsObj: any): number[] {
  const years = new Set<number>();
  if (factsObj && factsObj.facts && factsObj.facts["us-gaap"]) {
    const usGaap = factsObj.facts["us-gaap"];
    const checkKeys = ["NetIncomeLoss", "Revenues", "Assets"];
    for (const key of checkKeys) {
      const fact = usGaap[key];
      if (fact && fact.units) {
        for (const unitKey of Object.keys(fact.units)) {
          const list = fact.units[unitKey];
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item && item.fy) {
                years.add(item.fy);
              }
            }
          }
        }
      }
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Resolves conflicts across multiple API providers and compiles a clean, normalized CompanyMarketSnapshot.
 */
export function buildSnapshot(bundle: EvidenceBundle): CompanyMarketSnapshot {
  const provenance: Record<string, string> = {};

  // Helper to extract a field from profiles in priority: FMP > Finnhub
  const getProfileField = <T>(field: string, defaultValue: T): T => {
    const fmpProfile = bundle.companyProfiles.find(p => p.provider === "FMP")?.data as Record<string, any>;
    if (fmpProfile && fmpProfile[field] !== undefined && fmpProfile[field] !== null) {
      return fmpProfile[field] as T;
    }
    const finnhubProfile = bundle.companyProfiles.find(p => p.provider === "Finnhub")?.data as Record<string, any>;
    if (finnhubProfile && finnhubProfile[field] !== undefined && finnhubProfile[field] !== null) {
      return finnhubProfile[field] as T;
    }
    return defaultValue;
  };

  // Compile Company Details
  // Compile Company Details
  const countryClean = (bundle.company.country || "").trim().toLowerCase();
  const exchangeClean = (bundle.company.exchange || "").trim().toUpperCase();
  const isIndia = countryClean === "india" || exchangeClean === "nse" || exchangeClean === "bse" || exchangeClean === "ns" || exchangeClean === "bo";

  const finnhubQuote = bundle.quotes.find(q => q.provider === "Finnhub")?.data as Record<string, any>;
  const yahooQuote = bundle.quotes.find(q => q.provider === "Yahoo Finance")?.data as Record<string, any>;
  const tdQuote = bundle.quotes.find(q => q.provider === "Twelve Data")?.data as Record<string, any>;
  const avQuote = bundle.quotes.find(q => q.provider === "Alpha Vantage")?.data as Record<string, any>;
  const fmpQuote = bundle.quotes.find(q => q.provider === "FMP")?.data as Record<string, any>;

  const company: CompanyDetails = {
    name: bundle.company.name,
    ticker: bundle.company.ticker,
    exchange: bundle.company.exchange || getProfileField("exchange", null) || (yahooQuote?.exchange || null),
    country: bundle.company.country || getProfileField("country", null) || getProfileField("countryName", null),
    sector: getProfileField("sector", null),
    industry: getProfileField("industry", null) || getProfileField("finnhubIndustry", null),
    description: getProfileField("description", null),
    currency: (bundle.company.country === "India" || bundle.company.exchange === "NSE" || bundle.company.exchange === "BSE" || isIndia) ? "INR" : (yahooQuote?.currency || "USD"),
  };

  // Compile Market Data
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

  const hasPriceVal = (q: any) => {
    if (!q) return false;
    return q.price !== undefined || q.currentPrice !== undefined || q.close !== undefined;
  };

  const selectQuote = () => {
    if (isIndia) {
      if (hasPriceVal(yahooQuote)) return { q: yahooQuote, p: "Yahoo Finance" };
      if (hasPriceVal(tdQuote)) return { q: tdQuote, p: "Twelve Data" };
      if (hasPriceVal(finnhubQuote)) return { q: finnhubQuote, p: "Finnhub" };
      if (hasPriceVal(avQuote)) return { q: avQuote, p: "Alpha Vantage" };
    } else {
      if (hasPriceVal(finnhubQuote)) return { q: finnhubQuote, p: "Finnhub" };
      if (hasPriceVal(yahooQuote)) return { q: yahooQuote, p: "Yahoo Finance" };
      if (hasPriceVal(tdQuote)) return { q: tdQuote, p: "Twelve Data" };
      if (hasPriceVal(avQuote)) return { q: avQuote, p: "Alpha Vantage" };
    }
    if (hasPriceVal(fmpQuote)) return { q: fmpQuote, p: "FMP" };
    return null;
  };

  let deviationPercent: number | null = null;
  let validationStatus: "consistent" | "divergent" | "unchecked" = "unchecked";
  let primarySource = "None";
  let comparedSource = "None";

  const selectedQuote = selectQuote();
  if (selectedQuote) {
    const q = selectedQuote.q;
    const p = selectedQuote.p;
    primarySource = p;
    
    price = parseFloat(q.price !== undefined ? q.price : (q.currentPrice !== undefined ? q.currentPrice : q.close || 0)) || null;
    change = parseFloat(q.change || 0) || null;
    changePercent = parseFloat(q.changePercent !== undefined ? q.changePercent : (q.changesPercentage !== undefined ? q.changesPercentage : q.percent_change || 0)) || null;
    high = parseFloat(q.high || q.dayHigh || q.day_high || 0) || null;
    low = parseFloat(q.low || q.dayLow || q.day_low || 0) || null;
    previousClose = parseFloat(q.previousClose || q.prevClose || q.previous_close || 0) || null;
    volume = parseFloat(q.volume || 0) || null;
    marketCap = parseFloat(q.marketCap || q.mcap || q.market_cap || 0) || null;
    sharesOutstanding = parseFloat(q.sharesOutstanding || q.sharesOutstandingTotal || 0) || null;
    pe = parseFloat(q.pe || q.peRatio || q.p_e || 0) || null;

    provenance["market"] = p;
    provenance["market.price"] = p;
    provenance["market.volume"] = p;
    provenance["market.quote"] = p;

    // Cross-provider price validation: Compare chosen quote with Yahoo Finance (or chosen Yahoo with backup)
    if (p !== "Yahoo Finance" && yahooQuote) {
      const yPrice = parseFloat(yahooQuote.price !== undefined ? yahooQuote.price : (yahooQuote.currentPrice !== undefined ? yahooQuote.currentPrice : yahooQuote.close || 0));
      if (price && yPrice) {
        comparedSource = "Yahoo Finance";
        deviationPercent = (Math.abs(price - yPrice) / price) * 100;
        validationStatus = deviationPercent >= 1.0 ? "divergent" : "consistent";
      }
    } else if (p === "Yahoo Finance") {
      const backupQuote = hasPriceVal(finnhubQuote)
        ? { q: finnhubQuote, p: "Finnhub" }
        : (hasPriceVal(tdQuote) ? { q: tdQuote, p: "Twelve Data" } : null);
      
      if (backupQuote) {
        comparedSource = backupQuote.p;
        const backupPrice = parseFloat(backupQuote.q.price !== undefined ? backupQuote.q.price : (backupQuote.q.currentPrice !== undefined ? backupQuote.q.currentPrice : backupQuote.q.close || 0));
        if (price && backupPrice) {
          deviationPercent = (Math.abs(price - backupPrice) / price) * 100;
          validationStatus = deviationPercent >= 1.0 ? "divergent" : "consistent";
        }
      }
    }
  }

  // Fallback for metadata from Yahoo Finance if missing from primary feeds
  if (sharesOutstanding === null && yahooQuote && typeof yahooQuote.sharesOutstanding === "number") {
    sharesOutstanding = yahooQuote.sharesOutstanding;
    provenance["market.sharesOutstanding"] = "Yahoo Finance";
  }
  if (marketCap === null && yahooQuote && typeof yahooQuote.marketCap === "number") {
    marketCap = yahooQuote.marketCap;
    provenance["market.marketCap"] = "Yahoo Finance";
  }

  // Fallbacks for Market Cap, PE, PB, EPS
  const finnhubMetrics = bundle.metrics.find(m => m.provider === "Finnhub")?.data as Record<string, any>;
  const fmpMetrics = bundle.metrics.find(m => m.provider === "FMP")?.data as Record<string, any>[];
  const fmpRatios = bundle.ratios.find(r => r.provider === "FMP")?.data as Record<string, any>[];

  if (finnhubMetrics && finnhubMetrics.metric) {
    const m = finnhubMetrics.metric;
    if (pe === null) {
      pe = parseFloat(m["peNormalized"] || m["peTTM"] || 0) || null;
      if (pe !== null) provenance["market.pe"] = "Finnhub";
    }
    if (pb === null) {
      pb = parseFloat(m["pbAnnual"] || m["pbQuarterly"] || 0) || null;
      if (pb !== null) provenance["market.pb"] = "Finnhub";
    }
    if (marketCap === null) {
      marketCap = parseFloat(m["marketCapitalization"] || 0) * 1000000 || null; // Finnhub in Millions
      if (marketCap !== null) provenance["market.marketCap"] = "Finnhub";
    }
  }

  if (Array.isArray(fmpMetrics) && fmpMetrics.length > 0) {
    const latestMetric = fmpMetrics[0];
    if (pe === null) {
      pe = parseFloat(latestMetric.peRatio || 0) || null;
      if (pe !== null) provenance["market.pe"] = "FMP";
    }
    if (pb === null) {
      pb = parseFloat(latestMetric.pbRatio || 0) || null;
      if (pb !== null) provenance["market.pb"] = "FMP";
    }
  }
  if (Array.isArray(fmpRatios) && fmpRatios.length > 0) {
    const latestRatio = fmpRatios[0];
    if (pb === null) {
      pb = parseFloat(latestRatio.pbRatio || 0) || null;
      if (pb !== null) provenance["market.pb"] = "FMP";
    }
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

  const tdHistory = bundle.historicalPrices.find(h => h.provider === "Twelve Data")?.data as Record<string, any>[];
  const yahooHistory = bundle.historicalPrices.find(h => h.provider === "Yahoo Finance")?.data as Record<string, any>[];
  const avHistory = bundle.historicalPrices.find(h => h.provider === "Alpha Vantage")?.data as Record<string, any>[];
  const fmpHistory = bundle.historicalPrices.find(h => h.provider === "FMP")?.data as Record<string, any>[];

  const selectedHistory = tdHistory || yahooHistory || avHistory || fmpHistory;
  if (selectedHistory) {
    provenance["history"] = tdHistory ? "Twelve Data" : yahooHistory ? "Yahoo Finance" : avHistory ? "Alpha Vantage" : "FMP";
  }

  if (Array.isArray(selectedHistory) && selectedHistory.length > 1) {
    historyLength = selectedHistory.length;
    const prices = selectedHistory.map(item => parseFloat(item.close || item.price || 0)).filter(p => p > 0);
    if (prices.length > 1) {
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

  const secFacts = bundle.financialStatements.find(s => s.provider === "SEC EDGAR" && s.endpoint === "Company Facts")?.data as Record<string, any>;
  
  if (secFacts && secFacts.facts) {
    provenance["financials"] = "SEC EDGAR";
    const years = getSecFactYears(secFacts);
    for (const year of years) {
      const rev = getSecFactValue(secFacts, ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet", "SalesRevenueGoodsNet"], year);
      const netInc = getSecFactValue(secFacts, ["NetIncomeLoss"], year);
      const opsCash = getSecFactValue(secFacts, ["NetCashProvidedByUsedInOperatingActivities"], year);
      const capEx = getSecFactValue(secFacts, ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"], year);
      const assets = getSecFactValue(secFacts, ["Assets"], year);
      const liab = getSecFactValue(secFacts, ["Liabilities", "LiabilitiesAndStockholdersEquity"], year);

      financialsMap[year] = {
        year,
        revenue: rev,
        netIncome: netInc,
        operatingCashFlow: opsCash,
        freeCashFlow: (opsCash !== null && capEx !== null) ? (opsCash - capEx) : opsCash,
        totalAssets: assets,
        totalLiabilities: liab,
        debtToEquity: null,
        roe: null,
      };
    }
  } else {
    // Fallback: FMP statement collections
    const fmpIncome = bundle.financialStatements.find(s => s.provider === "FMP" && s.endpoint.includes("Income"))?.data as any[];
    const fmpBalance = bundle.financialStatements.find(s => s.provider === "FMP" && s.endpoint.includes("Balance"))?.data as any[];
    const fmpCashFlow = bundle.financialStatements.find(s => s.provider === "FMP" && s.endpoint.includes("Cash"))?.data as any[];

    const addStatementData = (stmtList: any[], type: "income" | "balance" | "cashflow") => {
      if (!Array.isArray(stmtList)) return;
      provenance["financials"] = "FMP";
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

    addStatementData(fmpIncome, "income");
    addStatementData(fmpBalance, "balance");
    addStatementData(fmpCashFlow, "cashflow");
  }

  // Fill Metrics like Debt to Equity, ROE per year
  for (const year of Object.keys(financialsMap).map(Number)) {
    const f = financialsMap[year];

    const metricItem = fmpMetrics?.find(m => parseInt(m.calendarYear || m.year) === year);
    const ratioItem = fmpRatios?.find(r => parseInt(r.calendarYear || r.year) === year);

    if (metricItem) {
      f.debtToEquity = parseFloat(metricItem.debtToEquity || 0) || null;
      f.roe = parseFloat(metricItem.roe || 0) || null;
    }
    if (ratioItem && f.roe === null) {
      f.roe = parseFloat(ratioItem.returnOnEquity || 0) || null;
    }

    // Mathematical Fallback for ROE: netIncome / (totalAssets - totalLiabilities)
    if (f.roe === null && typeof f.netIncome === "number" && f.totalAssets && f.totalLiabilities) {
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

  // Compile Web Context (empty now since Tavily is disabled)
  const web: WebContext = {
    answer: null,
    results: [],
  };

  // Compile Provider Endpoint Statuses
  const providerNames = ["FMP", "Finnhub", "Twelve Data", "SEC EDGAR", "NewsAPI", "Alpha Vantage", "Yahoo Finance"];
  const providers: ProviderStatus[] = providerNames.map(provider => {
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

  // --- Calculate Category Assessments ---
  // 1. Price History Status
  let priceHistoryStatus: "sufficient" | "insufficient" | "unavailable" = "unavailable";
  let priceHistoryReason = "No price history data available.";
  if (historyLength > 0) {
    if (historyLength >= 500) {
      priceHistoryStatus = "sufficient";
      priceHistoryReason = `Retrieved ${historyLength} trading days of price history over the last 2-3 years without significant gaps.`;
    } else {
      priceHistoryStatus = "insufficient";
      priceHistoryReason = `Retrieved only ${historyLength} trading days of price history, which is less than the required 2 years.`;
    }
  }

  // 2. Financial Capacity Status
  let financialCapacityStatus: "strong" | "moderate" | "weak" | "unavailable" = "unavailable";
  let financialCapacityReason = "No financial data available.";
  if (financials.length > 0) {
    const anyNegativeIncome = financials.some(f => f.netIncome !== null && f.netIncome < 0);
    const allPositiveIncome = financials.every(f => f.netIncome === null || f.netIncome > 0);

    const equities = financials
      .map(f => (f.totalAssets !== null && f.totalLiabilities !== null) ? f.totalAssets - f.totalLiabilities : null)
      .filter((e): e is number => e !== null);

    let equityGrowth = true;
    let minorEquityDrop = false;
    if (equities.length >= 2) {
      const latestEquity = equities[0];
      const oldestEquity = equities[equities.length - 1];
      if (latestEquity < oldestEquity) {
        equityGrowth = false;
        minorEquityDrop = latestEquity >= oldestEquity * 0.9;
      }
    }

    const d2es = financials.map(f => f.debtToEquity).filter((d): d is number => d !== null);
    const maxD2E = d2es.length > 0 ? Math.max(...d2es) : null;

    if (anyNegativeIncome || (maxD2E !== null && maxD2E > 3.0) || (!equityGrowth && !minorEquityDrop)) {
      financialCapacityStatus = "weak";
      financialCapacityReason = "Weak financial capacity: negative net income in one or more years, high debt-to-equity (> 3.0), or declining equity.";
    } else if (allPositiveIncome && ((maxD2E !== null && maxD2E >= 1.5 && maxD2E <= 3.0) || minorEquityDrop || maxD2E === null)) {
      financialCapacityStatus = "moderate";
      financialCapacityReason = "Moderate financial capacity: positive net income, but moderate debt-to-equity (1.5-3.0) or minor equity drop.";
    } else if (allPositiveIncome && equityGrowth && (maxD2E !== null && maxD2E < 1.5)) {
      financialCapacityStatus = "strong";
      financialCapacityReason = "Strong financial capacity: consistent positive net income, positive equity growth, and low debt-to-equity (< 1.5).";
    } else {
      financialCapacityStatus = "moderate";
      financialCapacityReason = "Moderate financial capacity: positive net income, but some metrics are missing or moderate.";
    }
  }

  // 3. Cash Flow Status
  let cashFlowStatus: "positive" | "mixed" | "negative" | "unavailable" = "unavailable";
  let cashFlowReason = "No cash flow data available.";
  if (financials.length > 0) {
    const allOpsCashPositive = financials.every(f => f.operatingCashFlow === null || f.operatingCashFlow > 0);
    const anyOpsCashNegative = financials.some(f => f.operatingCashFlow !== null && f.operatingCashFlow < 0);
    const allFcfPositive = financials.every(f => f.freeCashFlow === null || f.freeCashFlow > 0);
    const anyFcfNegative = financials.some(f => f.freeCashFlow !== null && f.freeCashFlow < 0);

    if (anyOpsCashNegative || (anyFcfNegative && financials.every(f => f.freeCashFlow !== null && f.freeCashFlow <= 0))) {
      cashFlowStatus = "negative";
      cashFlowReason = "Negative cash flow: operating cash flow is negative or free cash flow is consistently negative.";
    } else if (allOpsCashPositive && allFcfPositive) {
      cashFlowStatus = "positive";
      cashFlowReason = "Positive cash flow: operating cash flow is positive and capex is fully covered (free cash flow is positive) in all years.";
    } else if (allOpsCashPositive && anyFcfNegative) {
      cashFlowStatus = "mixed";
      cashFlowReason = "Mixed cash flow: operating cash flow is positive, but capex is high, leading to negative free cash flow in some years.";
    } else {
      cashFlowStatus = "mixed";
      cashFlowReason = "Mixed or incomplete cash flow details.";
    }
  }

  // 4. News Status
  let newsStatus: "positive" | "negative" | "mixed" | "neutral" | "unavailable" = "unavailable";
  let newsReason = "No news articles found.";
  const newsList = news.slice(0, 10);
  if (newsList.length > 0) {
    const positiveWords = ["growth", "profit", "record", "gain", "upgrade", "buy", "bullish", "success", "beat", "higher", "positive", "strong"];
    const negativeWords = ["drop", "loss", "decline", "fall", "downgrade", "sell", "bearish", "lawsuit", "warn", "debt", "lower", "weak", "concern", "dispute", "investigation", "probe", "fine", "penalty"];

    let posCount = 0;
    let negCount = 0;
    for (const article of newsList) {
      const text = `${article.title} ${article.summary || ""}`.toLowerCase();
      for (const word of positiveWords) {
        if (text.includes(word)) posCount++;
      }
      for (const word of negativeWords) {
        if (text.includes(word)) negCount++;
      }
    }

    if (posCount === 0 && negCount === 0) {
      newsStatus = "neutral";
      newsReason = "Neutral sentiment: News articles are purely factual without major positive or negative sentiment.";
    } else if (negCount > posCount * 1.5) {
      newsStatus = "negative";
      newsReason = "Negative sentiment: News articles highlight key concerns, lawsuits, regulatory issues, or declines.";
    } else if (posCount > negCount * 1.5) {
      newsStatus = "positive";
      newsReason = "Positive sentiment: Mostly positive news articles highlighting growth, profits, or successes.";
    } else {
      newsStatus = "mixed";
      newsReason = "Mixed sentiment: Combination of positive and negative articles or moderate concerns.";
    }
  }

  // 5. Market Value Status
  let marketValueStatus: "valued" | "unavailable" = "unavailable";
  let marketValueReason = "Market capitalization is unavailable.";
  let resolvedMarketCap = market.marketCap;

  if (resolvedMarketCap === null && market.price !== null && market.sharesOutstanding !== null) {
     resolvedMarketCap = market.price * market.sharesOutstanding;
  }

  if (resolvedMarketCap !== null && resolvedMarketCap > 0) {
    marketValueStatus = "valued";
    marketValueReason = `Market value is successfully determined ($${(resolvedMarketCap / 1e9).toFixed(2)}B).`;
  }

  const categoryAssessments = {
    priceHistory: {
      status: priceHistoryStatus,
      daysCount: historyLength,
      reason: priceHistoryReason,
    },
    financialCapacity: {
      status: financialCapacityStatus,
      reason: financialCapacityReason,
    },
    cashFlow: {
      status: cashFlowStatus,
      reason: cashFlowReason,
    },
    news: {
      status: newsStatus,
      reason: newsReason,
    },
    marketValue: {
      status: marketValueStatus,
      marketCap: resolvedMarketCap,
      reason: marketValueReason,
    },
  };

  return {
    company,
    market,
    history,
    financials,
    news: newsList,
    web,
    providers,
    categoryAssessments,
    provenance,
    validation: {
      deviationPercent,
      status: validationStatus,
      primarySource,
      comparedSource,
    },
  };
}
