import "server-only";
import { CompanyIdentity, getProviderCandidates } from "../company/symbolCandidates";
import {
  fmpProvider,
  finnhubProvider,
  twelveDataProvider,
  eodhdProvider,
  newsApiProvider,
  tavilyProvider,
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
      // If error is code-related (e.g. rate limit, invalid key), stop candidate checking
      if (result.status === "rate_limit" || result.status === "auth_error") {
        return {
          resolvedSymbol: null,
          verifiedResult: result, // Return the rate limit / auth error result
          tried,
        };
      }
    } catch (err: any) {
      logger.warn(`Candidate verification failed for ${providerName} symbol ${candidate}`, err);
    }
  }

  return { resolvedSymbol: null, verifiedResult: null, tried };
}

/**
 * Runs the full diagnostic pipeline on all 6 providers in parallel.
 */
export async function runDiagnosticsPipeline(company: CompanyIdentity): Promise<DiagnosticsRunPayload> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  const candidates = getProviderCandidates(company);

  // 1. Sequentially resolve symbol candidates for each provider in parallel.
  // We run candidate resolution for FMP, Finnhub, Twelve Data, EODHD in parallel.
  const [fmpResolution, finnhubResolution, twelveDataResolution, eodhdResolution] = await Promise.all([
    resolveSymbolAndVerify("FMP", candidates.fmp, (cand, tried) =>
      fmpProvider.getProfile(cand, tried)
    ),
    resolveSymbolAndVerify("Finnhub", candidates.finnhub, (cand, tried) =>
      finnhubProvider.getProfile(cand, tried)
    ),
    resolveSymbolAndVerify("Twelve Data", candidates.twelveData, (cand, tried) =>
      twelveDataProvider.getQuote(cand, null, tried)
    ),
    resolveSymbolAndVerify("EODHD", candidates.eodhd, (cand, tried) =>
      eodhdProvider.getQuote(cand, tried)
    ),
  ]);

  // Store resolved symbols
  const fmpSymbol = fmpResolution.resolvedSymbol;
  const finnhubSymbol = finnhubResolution.resolvedSymbol;
  const twelveDataSymbol = twelveDataResolution.resolvedSymbol;
  const eodhdSymbol = eodhdResolution.resolvedSymbol;

  // Collect the validation results to output them
  const initialEndpoints: EndpointResult[] = [];
  if (fmpResolution.verifiedResult) initialEndpoints.push(fmpResolution.verifiedResult);
  if (finnhubResolution.verifiedResult) initialEndpoints.push(finnhubResolution.verifiedResult);
  if (twelveDataResolution.verifiedResult) initialEndpoints.push(twelveDataResolution.verifiedResult);
  if (eodhdResolution.verifiedResult) initialEndpoints.push(eodhdResolution.verifiedResult);

  // 2. Prepare remaining symbol-dependent endpoint tasks
  const pendingTasks: Promise<EndpointResult | EndpointResult[]>[] = [];

  // FMP remaining tasks (9 endpoints)
  if (fmpSymbol) {
    pendingTasks.push(fmpProvider.getQuote(fmpSymbol));
    pendingTasks.push(fmpProvider.getIncomeStatements(fmpSymbol));
    pendingTasks.push(fmpProvider.getBalanceSheets(fmpSymbol));
    pendingTasks.push(fmpProvider.getCashFlowStatements(fmpSymbol));
    pendingTasks.push(fmpProvider.getKeyMetrics(fmpSymbol));
    pendingTasks.push(fmpProvider.getFinancialRatios(fmpSymbol));
    pendingTasks.push(fmpProvider.getHistoricalPrice(fmpSymbol));
    pendingTasks.push(fmpProvider.getPeers(fmpSymbol));
  }

  // Finnhub remaining tasks (5 endpoints)
  if (finnhubSymbol) {
    pendingTasks.push(finnhubProvider.getQuote(finnhubSymbol));
    pendingTasks.push(finnhubProvider.getBasicMetrics(finnhubSymbol));
    pendingTasks.push(finnhubProvider.getPeers(finnhubSymbol));
    pendingTasks.push(finnhubProvider.getCompanyNews(finnhubSymbol));
  }

  // Twelve Data remaining tasks (1 endpoint)
  if (twelveDataSymbol) {
    pendingTasks.push(twelveDataProvider.getTimeSeries(twelveDataSymbol));
  }

  // EODHD remaining tasks (3 endpoints)
  if (eodhdSymbol) {
    pendingTasks.push(eodhdProvider.getEodHistory(eodhdSymbol));
    pendingTasks.push(eodhdProvider.getFundamentals(eodhdSymbol));
  }

  // NewsAPI task (query-based)
  pendingTasks.push(newsApiProvider.getRecentArticles(company.name));

  // Tavily task (5 query-based endpoints)
  pendingTasks.push(tavilyProvider.getDiagnostics(company.name));

  // 3. Execute all remaining tasks in parallel with Promise.allSettled
  const settled = await Promise.allSettled(pendingTasks);

  // Flatten and process results
  const additionalEndpoints: EndpointResult[] = [];
  settled.forEach((res) => {
    if (res.status === "fulfilled") {
      const val = res.value;
      if (Array.isArray(val)) {
        additionalEndpoints.push(...val);
      } else {
        additionalEndpoints.push(val);
      }
    } else {
      logger.error("Pipeline: Unexpected task rejection in settled Promise.all", res.reason);
    }
  });

  const allEndpoints = [...initialEndpoints, ...additionalEndpoints];

  // 4. Construct provider summaries
  const providerNames = ["FMP", "Finnhub", "Twelve Data", "EODHD", "NewsAPI", "Tavily"];
  const providersSummary: ProviderSummary[] = providerNames.map((p) => {
    const endpoints = allEndpoints.filter((e) => e.provider === p);
    const successCount = endpoints.filter((e) => e.ok).length;
    const totalCount = endpoints.length;

    let status: ProviderEndpointStatus = "success";
    let durationMs = 0;

    // Check overall status for the provider
    if (totalCount === 0) {
      status = "empty";
    } else {
      const rateLimits = endpoints.filter((e) => e.status === "rate_limit");
      const authErrors = endpoints.filter((e) => e.status === "auth_error");
      const timeouts = endpoints.filter((e) => e.status === "timeout");
      const networkErrors = endpoints.filter((e) => e.status === "network_error");
      const unsupported = endpoints.filter((e) => e.status === "unsupported");
      
      if (rateLimits.length > 0) {
        status = "rate_limit";
      } else if (authErrors.length > 0) {
        status = "auth_error";
      } else if (successCount === 0) {
        if (unsupported.length > 0) status = "unsupported";
        else if (timeouts.length > 0) status = "timeout";
        else if (networkErrors.length > 0) status = "network_error";
        else status = "provider_error";
      } else if (successCount < totalCount) {
        status = "partial";
      }

      durationMs = endpoints.reduce((sum, e) => sum + e.durationMs, 0);
    }

    let symbolUsed: string | null = null;
    let tried: string[] = [];

    if (p === "FMP") {
      symbolUsed = fmpSymbol;
      tried = fmpResolution.tried;
    } else if (p === "Finnhub") {
      symbolUsed = finnhubSymbol;
      tried = finnhubResolution.tried;
    } else if (p === "Twelve Data") {
      symbolUsed = twelveDataSymbol;
      tried = twelveDataResolution.tried;
    } else if (p === "EODHD") {
      symbolUsed = eodhdSymbol;
      tried = eodhdResolution.tried;
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

  const durationMs = Date.now() - startTime;
  const completedAt = new Date().toISOString();

  // Determine overall status
  let overallStatus: ProviderEndpointStatus = "success";
  const anyRateLimit = providersSummary.some((p) => p.status === "rate_limit");
  const anyAuthError = providersSummary.some((p) => p.status === "auth_error");
  const allFailed = providersSummary.every((p) => p.status !== "success" && p.status !== "partial");

  if (anyRateLimit) {
    overallStatus = "rate_limit";
  } else if (anyAuthError) {
    overallStatus = "auth_error";
  } else if (allFailed) {
    overallStatus = "provider_error";
  } else if (providersSummary.some((p) => p.status === "partial" || p.status !== "success")) {
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
