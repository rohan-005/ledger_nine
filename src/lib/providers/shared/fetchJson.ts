import "server-only";
import { EndpointResult, ProviderEndpointStatus } from "./types";
import { redactSecrets, redactObjectSecrets } from "./redact";
import { mapErrorStatus } from "./errors";
import { logger } from "@/src/lib/logger";

interface FetchJsonOptions {
  provider: string;
  endpointName: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  symbolRequested?: string | null;
  symbolUsed?: string | null;
  candidatesTried?: string[];
  query?: string | null;
  timeoutMs?: number;
  apiKeyCheck?: () => string | null; // Optional check to see if API key is missing before calling
}

/**
 * Executes a network request and wraps it in a unified EndpointResult contract.
 * Catches all errors (timeouts, network, HTTP statuses, rate limits) to guarantee isolation.
 */
export async function fetchJson(options: FetchJsonOptions): Promise<EndpointResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  
  const method = options.method || "GET";
  const symbolRequested = options.symbolRequested || null;
  const symbolUsed = options.symbolUsed || null;
  const candidatesTried = options.candidatesTried || [];
  const query = options.query || null;
  const timeoutMs = options.timeoutMs || 8000; // 8 seconds default timeout

  // Redacted request fields
  const redactedUrl = redactSecrets(options.url);

  const initialResult: EndpointResult = {
    provider: options.provider,
    endpointName: options.endpointName,
    status: "provider_error",
    ok: false,
    startedAt,
    completedAt: startedAt,
    durationMs: 0,
    httpStatus: null,
    request: {
      endpoint: redactedUrl,
      method,
      symbolRequested,
      symbolUsed,
      candidatesTried,
      query,
    },
    response: {
      recordCount: null,
      data: null,
      raw: null,
    },
    error: null,
  };

  // 1. Check API key configuration first
  if (options.apiKeyCheck) {
    try {
      const key = options.apiKeyCheck();
      if (!key) {
        const durationMs = Date.now() - startTime;
        return {
          ...initialResult,
          status: "auth_error",
          completedAt: new Date().toISOString(),
          durationMs,
          error: {
            code: "API_KEY_MISSING",
            message: `API key is not configured for ${options.provider}`,
          },
        };
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      return {
        ...initialResult,
        status: "auth_error",
        completedAt: new Date().toISOString(),
        durationMs,
        error: {
          code: "API_KEY_ERROR",
          message: err.message || `API key configuration error for ${options.provider}`,
        },
      };
    }
  }

  try {
    const response = await fetch(options.url, {
      method,
      headers: options.headers || {},
      body: options.body,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const httpStatus = response.status;
    const textOutput = await response.text();
    const durationMs = Date.now() - startTime;
    const completedAt = new Date().toISOString();

    let rawData: unknown = null;
    let parseErrorMsg = "";
    try {
      rawData = textOutput ? JSON.parse(textOutput) : null;
    } catch (e: any) {
      parseErrorMsg = e.message || "Failed to parse JSON";
      rawData = textOutput;
    }

    // Determine status
    let status: ProviderEndpointStatus = "success";
    let errorObj: { code: string | null; message: string } | null = null;

    if (!response.ok || parseErrorMsg) {
      const msg = !response.ok
        ? `HTTP status ${response.status}: ${textOutput}`
        : `JSON Parse Error: ${parseErrorMsg}`;
      
      status = mapErrorStatus(httpStatus, msg, rawData);
      
      let finalMsg = msg;
      if (status === "rate_limit") {
        finalMsg = `API limit reached for ${options.provider}`;
      } else if (status === "auth_error") {
        finalMsg = `Authentication failed: ${options.provider}`;
      }

      errorObj = {
        code: `HTTP_${httpStatus || "PARSE_ERROR"}`,
        message: redactSecrets(finalMsg),
      };
    } else {
      // Successful response but could still be a rate limit / paywall returned inside JSON (e.g. Twelve Data, EODHD)
      status = mapErrorStatus(httpStatus, "", rawData);
      if (status === "rate_limit") {
        errorObj = {
          code: "RATE_LIMIT",
          message: `API limit reached for ${options.provider}`,
        };
      } else if (status === "auth_error") {
        errorObj = {
          code: "AUTH_ERROR",
          message: `Authentication failed: ${options.provider}`,
        };
      } else if (status === "empty") {
        errorObj = {
          code: "EMPTY_DATASET",
          message: "No records found.",
        };
      } else if (status === "unsupported") {
        errorObj = {
          code: "UNSUPPORTED_SYMBOL",
          message: "Symbol unsupported by provider.",
        };
      }
    }

    // Calculate record count
    let recordCount: number | null = null;
    if (Array.isArray(rawData)) {
      recordCount = rawData.length;
    } else if (rawData && typeof rawData === "object") {
      // Check for records arrays (e.g., Twelve Data "values", FMP arrays, etc.)
      const obj = rawData as Record<string, any>;
      if (Array.isArray(obj.values)) {
        recordCount = obj.values.length;
      } else if (Array.isArray(obj.articles)) {
        recordCount = obj.articles.length;
      } else if (Array.isArray(obj.results)) {
        recordCount = obj.results.length;
      } else {
        recordCount = 1;
      }
    }

    const ok = status === "success";

    return {
      provider: options.provider,
      endpointName: options.endpointName,
      status,
      ok,
      startedAt,
      completedAt,
      durationMs,
      httpStatus,
      request: {
        endpoint: redactedUrl,
        method,
        symbolRequested,
        symbolUsed,
        candidatesTried,
        query,
      },
      response: {
        recordCount,
        data: null, // Client will populate this with normalized data if status === "success"
        raw: redactObjectSecrets(rawData),
      },
      error: errorObj,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const completedAt = new Date().toISOString();
    const isTimeout = error.name === "TimeoutError" || error.message?.toLowerCase().includes("timeout") || error.message?.toLowerCase().includes("abort");
    
    let status: ProviderEndpointStatus = isTimeout ? "timeout" : "network_error";
    if (error.message?.toLowerCase().includes("fetch failed")) {
      status = "network_error";
    }

    let finalMsg = error.message || "Unknown fetch error";
    if (status === "timeout") {
      finalMsg = `Request timed out for ${options.provider}`;
    }

    return {
      provider: options.provider,
      endpointName: options.endpointName,
      status,
      ok: false,
      startedAt,
      completedAt,
      durationMs,
      httpStatus: null,
      request: {
        endpoint: redactedUrl,
        method,
        symbolRequested,
        symbolUsed,
        candidatesTried,
        query,
      },
      response: {
        recordCount: null,
        data: null,
        raw: null,
      },
      error: {
        code: isTimeout ? "TIMEOUT" : "FETCH_ERROR",
        message: redactSecrets(finalMsg),
      },
    };
  }
}
