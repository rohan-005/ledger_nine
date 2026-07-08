import "server-only";
import { CompanyIdentity, getProviderCandidates } from "../company/symbolCandidates";
import {
  fmpProvider,
  finnhubProvider,
  twelveDataProvider,
  secProvider,
  newsApiProvider,
  alphaVantageProvider,
  EndpointResult,
  ProviderSummary,
  ProviderEndpointStatus,
} from "../providers";
import { logger } from "@/src/lib/logger";

interface DiagnosticsRunPayload {
  company: CompanyIdentity;
  overallStatus: ProviderEndpointStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  providers: ProviderSummary[];
  allEndpoints: EndpointResult[];
}

// In-memory cache to skip future FMP calls once plan_limit is detected
let fmpIsPlanLimited = false;

/**
 * Resolves symbol candidate sequentially for a given provider validation check.
 */
async function resolveSymbolAndVerify(
  providerName: string,
  candidates: string[],
  verifyFn: (candidate: string, tried: string[]) => Promise<EndpointResult>
): Promise<{ resolvedSymbol: string | null; verifiedResult: EndpointResult | null; tried: string[] }> {
  const tried: string[] = [];
  
  if (candidates.length === 0) {
    return { resolvedSymbol: null, verifiedResult: null, tried };
  }

  for (const candidate of candidates) {
    tried.push(candidate);
    try {
      const result = await verifyFn(candidate, [...tried]);
      if (result.ok) {
        return {
          resolvedSymbol: candidate,
          verifiedResult: result,
          tried,
        };
      }
      if (result.status === "rate_limit" || result.status === "auth_error") {
        return {
          resolvedSymbol: null,
          verifiedResult: result,
          tried,
        };
      }
    } catch (err: any) {
      logger.warn(`Candidate verification failed for ${providerName} symbol ${candidate}`, err);
    }
  }

  return { resolvedSymbol: null, verifiedResult: null, tried };
}

async function resolveTwelveDataSymbol(
  company: CompanyIdentity
): Promise<{ resolvedSymbol: string | null; verifiedResult: EndpointResult | null; tried: string[] }> {
  const display = company.displayTicker.toUpperCase().trim();
  const canonical = (company.canonicalTicker || display).toUpperCase().trim();
  const exchange = (company.exchange || "").trim().toUpperCase();
  const country = (company.country || "").trim().toLowerCase();
  const isIndia = country === "india" || exchange === "NSE" || exchange === "BSE";

  try {
    const searchResult = await twelveDataProvider.search(display);
    if (!searchResult.ok || !searchResult.response.data || !Array.isArray(searchResult.response.data)) {
      return { resolvedSymbol: null, verifiedResult: searchResult, tried: [display] };
    }

    const items = searchResult.response.data;
    let matchedItem = items.find((item: any) => {
      const sMatch = item.symbol.toUpperCase() === display || item.symbol.toUpperCase() === canonical;
      if (!sMatch) return false;

      if (isIndia) {
        const cIndia = (item.country || "").toLowerCase() === "india";
        const eIndia = ["NSE", "BSE", "NS", "BO"].includes((item.exchange || "").toUpperCase());
        return cIndia || eIndia;
      } else {
        const cUS = ["united states", "us"].includes((item.country || "").toLowerCase());
        const eUS = ["NASDAQ", "NYSE", "AMEX", "BATS", "ARCA"].includes((item.exchange || "").toUpperCase());
        return cUS || eUS;
      }
    });

    if (!matchedItem && items.length > 0) {
      matchedItem = items.find((item: any) => item.symbol.toUpperCase() === display || item.symbol.toUpperCase() === canonical);
    }

    if (matchedItem) {
      const resolved = matchedItem.exchange ? `${matchedItem.symbol}:${matchedItem.exchange}` : matchedItem.symbol;
      const quoteResult = await twelveDataProvider.getQuote(resolved, null, [display, resolved]);
      if (quoteResult.ok) {
        return { resolvedSymbol: resolved, verifiedResult: quoteResult, tried: [display, resolved] };
      }
      return { resolvedSymbol: null, verifiedResult: quoteResult, tried: [display, resolved] };
    }
  } catch (err: any) {
    logger.warn(`Twelve Data custom resolution failed`, err);
  }

  return { resolvedSymbol: null, verifiedResult: null, tried: [display] };
}

/**
 * Runs the capability-aware conditional diagnostics pipeline.
 */
export async function runDiagnosticsPipeline(company: CompanyIdentity): Promise<DiagnosticsRunPayload> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  const candidates = getProviderCandidates(company);

  const display = company.displayTicker.toUpperCase().trim();
  const exchange = (company.exchange || "").trim().toUpperCase();
  const country = (company.country || "").trim().toLowerCase();
  const isIndia = country === "india" || exchange === "NSE" || exchange === "BSE";

  const allEndpoints: EndpointResult[] = [];

  // --- 1. RESOLVE SYMBOLS (FINNHUB & TWELVE DATA) ---
  const [finnhubResolution, twelveDataResolution] = await Promise.all([
    resolveSymbolAndVerify("Finnhub", candidates.finnhub, (cand, tried) =>
      finnhubProvider.getProfile(cand, tried)
    ),
    resolveTwelveDataSymbol(company),
  ]);

  if (finnhubResolution.verifiedResult) allEndpoints.push(finnhubResolution.verifiedResult);
  if (twelveDataResolution.verifiedResult) allEndpoints.push(twelveDataResolution.verifiedResult);

  const finnhubSymbol = finnhubResolution.resolvedSymbol;
  const twelveDataSymbol = twelveDataResolution.resolvedSymbol;

  // --- 2. CONDITIONAL MARKET/QUOTE FETCHING ---
  let needMarketData = true;
  let finnhubQuoteRes: EndpointResult | null = null;
  let twelveDataQuoteRes: EndpointResult | null = null;
  let alphaVantageQuoteRes: EndpointResult | null = null;

  // Primary: Finnhub
  if (finnhubSymbol) {
    finnhubQuoteRes = await finnhubProvider.getQuote(finnhubSymbol);
    allEndpoints.push(finnhubQuoteRes);
    if (finnhubQuoteRes.ok && finnhubQuoteRes.response.data) {
      needMarketData = false;
    }
  }

  // Secondary: Twelve Data
  if (needMarketData && twelveDataSymbol) {
    if (twelveDataResolution.verifiedResult && twelveDataResolution.verifiedResult.ok && twelveDataResolution.verifiedResult.response.data) {
      // Already fetched quote in Twelve Data resolution step
      needMarketData = false;
    } else {
      twelveDataQuoteRes = await twelveDataProvider.getQuote(twelveDataSymbol);
      allEndpoints.push(twelveDataQuoteRes);
      if (twelveDataQuoteRes.ok && twelveDataQuoteRes.response.data) {
        needMarketData = false;
      }
    }
  }

  // Fallback: Alpha Vantage (last resort)
  let alphaVantageSymbol: string | null = null;
  if (needMarketData) {
    const avResolution = await resolveSymbolAndVerify("Alpha Vantage", candidates.alphaVantage, (cand, tried) =>
      alphaVantageProvider.getQuote(cand, tried)
    );
    if (avResolution.verifiedResult) {
      allEndpoints.push(avResolution.verifiedResult);
      if (avResolution.verifiedResult.ok && avResolution.verifiedResult.response.data) {
        alphaVantageSymbol = avResolution.resolvedSymbol;
        needMarketData = false;
      }
    }
  }

  // --- 3. CONDITIONAL OHLCV/TIME SERIES FETCHING ---
  let hasHistorical = false;

  // Primary: Twelve Data
  if (twelveDataSymbol) {
    const twelveDataTimeSeriesRes = await twelveDataProvider.getTimeSeries(twelveDataSymbol, null, 1000);
    allEndpoints.push(twelveDataTimeSeriesRes);
    if (twelveDataTimeSeriesRes.ok && twelveDataTimeSeriesRes.response.data) {
      hasHistorical = true;
    }
  }

  // Fallback: Alpha Vantage (only if Twelve Data time series failed/was empty)
  if (!hasHistorical) {
    // If not resolved during quote fallback, resolve now
    if (!alphaVantageSymbol) {
      const avResolution = await resolveSymbolAndVerify("Alpha Vantage", candidates.alphaVantage, (cand, tried) =>
        alphaVantageProvider.getQuote(cand, tried)
      );
      if (avResolution.verifiedResult) {
        allEndpoints.push(avResolution.verifiedResult);
        if (avResolution.verifiedResult.ok) {
          alphaVantageSymbol = avResolution.resolvedSymbol;
        }
      }
    }

    if (alphaVantageSymbol) {
      const avTimeSeriesRes = await alphaVantageProvider.getTimeSeries(alphaVantageSymbol);
      allEndpoints.push(avTimeSeriesRes);
    }
  }

  // --- 4. SEC EDGAR (US Filings - US ONLY) ---
  if (isIndia) {
    // Return not_applicable immediately for Indian companies
    allEndpoints.push({
      provider: "SEC EDGAR",
      endpointName: "Submissions",
      ok: false,
      status: "not_applicable",
      durationMs: 0,
      httpStatus: null,
      request: {
        endpoint: "Submissions",
        method: "GET",
        symbolRequested: display,
        symbolUsed: null,
        candidatesTried: [],
        query: null,
      },
      response: { recordCount: null, data: null, raw: null },
      error: { code: null, message: "SEC EDGAR is not applicable for Indian companies" },
      startedAt,
      completedAt: new Date().toISOString(),
    });
    allEndpoints.push({
      provider: "SEC EDGAR",
      endpointName: "Company Facts",
      ok: false,
      status: "not_applicable",
      durationMs: 0,
      httpStatus: null,
      request: {
        endpoint: "Company Facts",
        method: "GET",
        symbolRequested: display,
        symbolUsed: null,
        candidatesTried: [],
        query: null,
      },
      response: { recordCount: null, data: null, raw: null },
      error: { code: null, message: "SEC EDGAR is not applicable for Indian companies" },
      startedAt,
      completedAt: new Date().toISOString(),
    });
  } else {
    // Fetch submissions and facts in parallel
    const [subRes, factsRes] = await Promise.all([
      secProvider.getSubmissions(display, [display]),
      secProvider.getCompanyFacts(display, [display]),
    ]);
    allEndpoints.push(subRes, factsRes);
  }

  // --- 5. FMP (Optional Enrichment) ---
  let fmpSymbol: string | null = null;
  if (fmpIsPlanLimited) {
    // Instantly append a mocked plan_limit result
    allEndpoints.push({
      provider: "FMP",
      endpointName: "Profile",
      ok: false,
      status: "plan_limit",
      durationMs: 0,
      httpStatus: null,
      request: {
        endpoint: "Profile",
        method: "GET",
        symbolRequested: display,
        symbolUsed: null,
        candidatesTried: [],
        query: null,
      },
      response: { recordCount: null, data: null, raw: null },
      error: { code: "plan_limit", message: "FMP is plan-limited for current key" },
      startedAt,
      completedAt: new Date().toISOString(),
    });
  } else {
    const fmpResolution = await resolveSymbolAndVerify("FMP", candidates.fmp, (cand, tried) =>
      fmpProvider.getProfile(cand, tried)
    );
    if (fmpResolution.verifiedResult) {
      allEndpoints.push(fmpResolution.verifiedResult);
      if (fmpResolution.verifiedResult.status === "plan_limit" || fmpResolution.verifiedResult.status === "plan_limited") {
        fmpIsPlanLimited = true;
      }
    }
    fmpSymbol = fmpResolution.resolvedSymbol;

    if (fmpSymbol) {
      const [fmpQuote, fmpMetrics, fmpIncome] = await Promise.all([
        fmpProvider.getQuote(fmpSymbol),
        fmpProvider.getKeyMetrics(fmpSymbol),
        fmpProvider.getIncomeStatements(fmpSymbol),
      ]);
      allEndpoints.push(fmpQuote, fmpMetrics, fmpIncome);
      if (
        fmpQuote.status === "plan_limit" ||
        fmpMetrics.status === "plan_limit" ||
        fmpIncome.status === "plan_limit"
      ) {
        fmpIsPlanLimited = true;
      }
    }
  }

  // --- 6. NEWS (Finnhub & NewsAPI) ---
  const newsTasks: Promise<EndpointResult>[] = [
    newsApiProvider.getRecentArticles(company.name),
  ];
  if (finnhubSymbol) {
    newsTasks.push(finnhubProvider.getCompanyNews(finnhubSymbol));
  }
  const newsResults = await Promise.all(newsTasks);
  allEndpoints.push(...newsResults);

  // --- 7. ADDITIONAL FINNHUB METRICS ---
  if (finnhubSymbol) {
    const finnhubMetrics = await finnhubProvider.getBasicMetrics(finnhubSymbol);
    allEndpoints.push(finnhubMetrics);
  }

  const durationMs = Date.now() - startTime;
  const completedAt = new Date().toISOString();

  // --- 8. BUILD SUMMARIES ---
  const providerNames = ["FMP", "Finnhub", "Twelve Data", "SEC EDGAR", "NewsAPI", "Alpha Vantage"];
  const providersSummary: ProviderSummary[] = providerNames.map((p) => {
    const endpoints = allEndpoints.filter((e) => e.provider === p);
    const successCount = endpoints.filter((e) => e.ok).length;
    const totalCount = endpoints.length;

    let status: ProviderEndpointStatus = "success";
    let durationMs = 0;

    if (totalCount === 0) {
      status = "empty";
    } else {
      const rateLimits = endpoints.filter((e) => e.status === "rate_limit");
      const authErrors = endpoints.filter((e) => e.status === "auth_error");
      const planLimits = endpoints.filter((e) => e.status === "plan_limited" || e.status === "plan_limit");
      const timeouts = endpoints.filter((e) => e.status === "timeout");
      const networkErrors = endpoints.filter((e) => e.status === "network_error");
      const unsupported = endpoints.filter(
        (e) => e.status === "unsupported" || e.status === "unsupported_market" || e.status === "unsupported_symbol"
      );
      const notApplicable = endpoints.filter((e) => e.status === "not_applicable");
      
      if (rateLimits.length > 0) {
        status = "rate_limit";
      } else if (authErrors.length > 0) {
        status = "auth_error";
      } else if (planLimits.length > 0) {
        status = "plan_limited";
      } else if (successCount === 0) {
        if (notApplicable.length === totalCount) {
          status = "not_applicable";
        } else if (unsupported.length > 0) {
          const first = unsupported[0];
          status = first.status;
        } else if (timeouts.length > 0) {
          status = "timeout";
        } else if (networkErrors.length > 0) {
          status = "network_error";
        } else {
          status = "provider_error";
        }
      } else if (successCount < totalCount) {
        status = "partial";
      }

      durationMs = endpoints.reduce((sum, e) => sum + e.durationMs, 0);
    }

    let symbolUsed: string | null = null;
    let tried: string[] = [];

    if (p === "FMP") {
      symbolUsed = fmpSymbol;
      tried = candidates.fmp;
    } else if (p === "Finnhub") {
      symbolUsed = finnhubSymbol;
      tried = finnhubResolution.tried;
    } else if (p === "Twelve Data") {
      symbolUsed = twelveDataSymbol;
      tried = twelveDataResolution.tried;
    } else if (p === "SEC EDGAR") {
      symbolUsed = isIndia ? null : display;
      tried = [display];
    } else if (p === "Alpha Vantage") {
      symbolUsed = alphaVantageSymbol;
      tried = avResolutionTried(allEndpoints);
    }

    return {
      provider: p,
      status,
      durationMs,
      endpoints,
      symbolUsed,
      candidatesTried: tried,
    };
  });

  // Overall status determination
  let overallStatus: ProviderEndpointStatus = "success";
  const anyRateLimit = providersSummary.some((p) => p.status === "rate_limit");
  const anyAuthError = providersSummary.some((p) => p.status === "auth_error");
  const allFailed = providersSummary.every((p) => p.status !== "success" && p.status !== "partial" && p.status !== "not_applicable");

  if (anyRateLimit) {
    overallStatus = "rate_limit";
  } else if (anyAuthError) {
    overallStatus = "auth_error";
  } else if (allFailed) {
    overallStatus = "provider_error";
  } else if (providersSummary.some((p) => p.status === "partial" || (p.status !== "success" && p.status !== "not_applicable"))) {
    overallStatus = "partial";
  }

  return {
    company,
    overallStatus,
    startedAt,
    completedAt,
    durationMs,
    providers: providersSummary,
    allEndpoints,
  };
}

function avResolutionTried(allEndpoints: EndpointResult[]): string[] {
  const avEndpoints = allEndpoints.filter((e) => e.provider === "Alpha Vantage");
  if (avEndpoints.length > 0) {
    return avEndpoints[0].request.candidatesTried || [];
  }
  return [];
}
