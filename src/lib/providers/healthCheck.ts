import "server-only";
import { fmpProvider } from "./fmp";
import { finnhubProvider } from "./finnhub";
import { twelveDataProvider } from "./twelveData";
import { secProvider } from "./sec";
import { newsApiProvider } from "./newsapi";
import { alphaVantageProvider } from "./alphavantage";
import { yahooProvider } from "./yahoo";
import { getGroqApiKey } from "../env";
import Groq from "groq-sdk";

export interface ProviderHealthStatus {
  provider: string;
  status:
    | "working"
    | "partial"
    | "rate_limit"
    | "auth_error"
    | "plan_limited"
    | "unsupported"
    | "timeout"
    | "network_error"
    | "broken";
  checkedAt: string;
  durationMs: number;
  httpStatus: number | null;
  message: string;
  capabilities: string[];
}

let cachedHealth: {
  timestamp: number;
  statusMap: Record<string, string>;
  details: ProviderHealthStatus[];
} | null = null;

const CACHE_TTL_MS = 30000; // 30 seconds cache

/**
 * Runs lightweight probes for all providers to verify auth, availability, and response structures.
 */
export async function runAllProviderHealthChecks(force = false): Promise<{
  statusMap: Record<string, string>;
  details: ProviderHealthStatus[];
 }> {
  const now = Date.now();
  if (!force && cachedHealth && now - cachedHealth.timestamp < CACHE_TTL_MS) {
    return cachedHealth;
  }

  const checkPromises = [
    checkFmp(),
    checkFinnhub(),
    checkTwelveData(),
    checkSecEdgar(),
    checkNewsApi(),
    checkAlphaVantage(),
    checkYahoo(),
    checkGroq(),
  ];

  const details = await Promise.all(checkPromises);

  const statusMap: Record<string, string> = {};
  for (const d of details) {
    statusMap[d.provider] = d.status;
  }

  cachedHealth = {
    timestamp: now,
    statusMap,
    details,
  };

  return cachedHealth;
}

// Helpers for checks:

async function checkFmp(): Promise<ProviderHealthStatus> {
  const start = Date.now();
  try {
    const res = await fmpProvider.getProfile("AAPL");
    const durationMs = Date.now() - start;
    if (res.ok) {
      return {
        provider: "FMP",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: res.httpStatus,
        message: "FMP profile query succeeded.",
        capabilities: ["Quote", "Search", "Financial Statements", "Metrics", "Ratios", "Historical Prices"],
      };
    }
    return {
      provider: "FMP",
      status: mapEndpointStatusToHealth(res.status),
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: res.httpStatus,
      message: res.error?.message || "FMP request failed.",
      capabilities: [],
    };
  } catch (err: any) {
    return {
      provider: "FMP",
      status: "broken",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      httpStatus: null,
      message: err.message || "FMP health check error.",
      capabilities: [],
    };
  }
}

async function checkFinnhub(): Promise<ProviderHealthStatus> {
  const start = Date.now();
  try {
    const res = await finnhubProvider.search("AAPL");
    const durationMs = Date.now() - start;
    if (res.ok) {
      return {
        provider: "Finnhub",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: res.httpStatus,
        message: "Finnhub search query succeeded.",
        capabilities: ["Quote", "Search", "Basic Financials", "Company News"],
      };
    }
    return {
      provider: "Finnhub",
      status: mapEndpointStatusToHealth(res.status),
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: res.httpStatus,
      message: res.error?.message || "Finnhub request failed.",
      capabilities: [],
    };
  } catch (err: any) {
    return {
      provider: "Finnhub",
      status: "broken",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      httpStatus: null,
      message: err.message || "Finnhub health check error.",
      capabilities: [],
    };
  }
}

async function checkTwelveData(): Promise<ProviderHealthStatus> {
  const start = Date.now();
  try {
    const res = await twelveDataProvider.search("AAPL");
    const durationMs = Date.now() - start;
    if (res.ok) {
      return {
        provider: "Twelve Data",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: res.httpStatus,
        message: "Twelve Data search query succeeded.",
        capabilities: ["Quote", "Search", "Time Series"],
      };
    }
    return {
      provider: "Twelve Data",
      status: mapEndpointStatusToHealth(res.status),
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: res.httpStatus,
      message: res.error?.message || "Twelve Data request failed.",
      capabilities: [],
    };
  } catch (err: any) {
    return {
      provider: "Twelve Data",
      status: "broken",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      httpStatus: null,
      message: err.message || "Twelve Data health check error.",
      capabilities: [],
    };
  }
}

async function checkSecEdgar(): Promise<ProviderHealthStatus> {
  const start = Date.now();
  try {
    const res = await secProvider.getSubmissions("AAPL");
    const durationMs = Date.now() - start;
    if (res.ok) {
      return {
        provider: "SEC EDGAR",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: res.httpStatus,
        message: "SEC EDGAR AAPL submissions retrieved successfully.",
        capabilities: ["US filings", "CIK mapping", "Company Facts"],
      };
    }
    return {
      provider: "SEC EDGAR",
      status: mapEndpointStatusToHealth(res.status),
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: res.httpStatus,
      message: res.error?.message || "SEC EDGAR request failed.",
      capabilities: [],
    };
  } catch (err: any) {
    return {
      provider: "SEC EDGAR",
      status: "broken",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      httpStatus: null,
      message: err.message || "SEC EDGAR health check error.",
      capabilities: [],
    };
  }
}

async function checkNewsApi(): Promise<ProviderHealthStatus> {
  const start = Date.now();
  try {
    const res = await newsApiProvider.getRecentArticles("Apple Inc.");
    const durationMs = Date.now() - start;
    if (res.ok) {
      return {
        provider: "NewsAPI",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: res.httpStatus,
        message: "NewsAPI articles query succeeded.",
        capabilities: ["News (Articles)"],
      };
    }
    return {
      provider: "NewsAPI",
      status: mapEndpointStatusToHealth(res.status),
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: res.httpStatus,
      message: res.error?.message || "NewsAPI request failed.",
      capabilities: [],
    };
  } catch (err: any) {
    return {
      provider: "NewsAPI",
      status: "broken",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      httpStatus: null,
      message: err.message || "NewsAPI health check error.",
      capabilities: [],
    };
  }
}

async function checkAlphaVantage(): Promise<ProviderHealthStatus> {
  const start = Date.now();
  try {
    const res = await alphaVantageProvider.search("AAPL");
    const durationMs = Date.now() - start;
    if (res.ok) {
      return {
        provider: "Alpha Vantage",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: res.httpStatus,
        message: "Alpha Vantage search query succeeded.",
        capabilities: ["Quote", "Search", "Time Series"],
      };
    }
    return {
      provider: "Alpha Vantage",
      status: mapEndpointStatusToHealth(res.status),
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: res.httpStatus,
      message: res.error?.message || "Alpha Vantage request failed.",
      capabilities: [],
    };
  } catch (err: any) {
    return {
      provider: "Alpha Vantage",
      status: "broken",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      httpStatus: null,
      message: err.message || "Alpha Vantage health check error.",
      capabilities: [],
    };
  }
}

async function checkYahoo(): Promise<ProviderHealthStatus> {
  const start = Date.now();
  try {
    const res = await yahooProvider.getQuote("AAPL");
    const durationMs = Date.now() - start;
    if (res.ok) {
      return {
        provider: "Yahoo Finance",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: res.httpStatus,
        message: "Yahoo Finance quote query succeeded.",
        capabilities: ["Quote", "Search", "Historical Prices", "Shares Outstanding", "Exchange/Currency Metadata"],
      };
    }
    return {
      provider: "Yahoo Finance",
      status: mapEndpointStatusToHealth(res.status),
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: res.httpStatus,
      message: res.error?.message || "Yahoo Finance request failed.",
      capabilities: [],
    };
  } catch (err: any) {
    return {
      provider: "Yahoo Finance",
      status: "broken",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      httpStatus: null,
      message: err.message || "Yahoo Finance health check error.",
      capabilities: [],
    };
  }
}

async function checkGroq(): Promise<ProviderHealthStatus> {
  const start = Date.now();
  const key = getGroqApiKey();
  try {
    if (!key) {
      return {
        provider: "Groq",
        status: "auth_error",
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        httpStatus: null,
        message: "API Key not configured",
        capabilities: [],
      };
    }

    const groq = new Groq({ apiKey: key });
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: "Reply with exactly OK" }],
      max_completion_tokens: 5,
    });

    const durationMs = Date.now() - start;
    const contentText = response.choices[0]?.message?.content;
    if (contentText && contentText.trim().toUpperCase().includes("OK")) {
      return {
        provider: "Groq",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: 200,
        message: "Groq response succeeded.",
        capabilities: ["Qualitative AI Synthesis", "Textual Analysis"],
      };
    }
    return {
      provider: "Groq",
      status: "broken",
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: null,
      message: "Groq returned an invalid response content: " + (contentText || "empty"),
      capabilities: [],
    };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const msg = err.message || "";
    let status: ProviderHealthStatus["status"] = "broken";

    if (msg.includes("rate limit") || msg.includes("429") || msg.includes("quota")) {
      status = "rate_limit";
    } else if (msg.includes("API key") || msg.includes("auth") || msg.includes("401") || msg.includes("403")) {
      status = "auth_error";
    } else if (msg.includes("timeout")) {
      status = "timeout";
    }

    const cleanMsg = msg.replace(key || "key-not-found", "REDACTED_API_KEY");

    return {
      provider: "Groq",
      status,
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: null,
      message: cleanMsg,
      capabilities: [],
    };
  }
}

function mapEndpointStatusToHealth(status: string): ProviderHealthStatus["status"] {
  switch (status) {
    case "success":
      return "working";
    case "rate_limit":
      return "rate_limit";
    case "auth_error":
      return "auth_error";
    case "plan_limited":
    case "plan_limit":
      return "plan_limited";
    case "unsupported":
    case "unsupported_symbol":
    case "unsupported_market":
      return "unsupported";
    case "timeout":
      return "timeout";
    case "network_error":
      return "network_error";
    default:
      return "broken";
  }
}
