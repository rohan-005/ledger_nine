import "server-only";
import { fmpProvider } from "./fmp";
import { finnhubProvider } from "./finnhub";
import { twelveDataProvider } from "./twelveData";
import { eodhdProvider } from "./eodhd";
import { newsApiProvider } from "./newsapi";
import { tavilyProvider } from "./tavily";
import { alphaVantageProvider } from "./alphavantage";
import { getGeminiApiKey, getGroqApiKey } from "../env";
import { GoogleGenAI } from "@google/genai";
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
    checkEodhd(),
    checkNewsApi(),
    checkTavily(),
    checkAlphaVantage(),
    checkGemini(),
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
    const res = await fmpProvider.search("AAPL");
    const durationMs = Date.now() - start;
    if (res.ok) {
      return {
        provider: "FMP",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: res.httpStatus,
        message: "FMP search query succeeded.",
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

async function checkEodhd(): Promise<ProviderHealthStatus> {
  const start = Date.now();
  try {
    const res = await eodhdProvider.search("AAPL");
    const durationMs = Date.now() - start;
    if (res.ok) {
      return {
        provider: "EODHD",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: res.httpStatus,
        message: "EODHD search query succeeded.",
        capabilities: ["Quote", "Search", "Fundamentals (Profile)", "Historical Prices"],
      };
    }
    return {
      provider: "EODHD",
      status: mapEndpointStatusToHealth(res.status),
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: res.httpStatus,
      message: res.error?.message || "EODHD request failed.",
      capabilities: [],
    };
  } catch (err: any) {
    return {
      provider: "EODHD",
      status: "broken",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      httpStatus: null,
      message: err.message || "EODHD health check error.",
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

async function checkTavily(): Promise<ProviderHealthStatus> {
  const start = Date.now();
  try {
    const results = await tavilyProvider.getDiagnostics("Apple Inc.");
    const res = results[0]; // Check first of the 5 parallel queries
    const durationMs = Date.now() - start;
    if (res && res.ok) {
      return {
        provider: "Tavily",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: res.httpStatus,
        message: "Tavily search query succeeded.",
        capabilities: ["Web Research"],
      };
    }
    return {
      provider: "Tavily",
      status: res ? mapEndpointStatusToHealth(res.status) : "broken",
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: res ? res.httpStatus : null,
      message: res?.error?.message || "Tavily request failed.",
      capabilities: [],
    };
  } catch (err: any) {
    return {
      provider: "Tavily",
      status: "broken",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      httpStatus: null,
      message: err.message || "Tavily health check error.",
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

async function checkGemini(): Promise<ProviderHealthStatus> {
  const start = Date.now();
  let key: string | null = null;
  try {
    key = getGeminiApiKey();
    if (!key) {
      return {
        provider: "Gemini",
        status: "auth_error",
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        httpStatus: null,
        message: "API Key not configured",
        capabilities: [],
      };
    }

    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Reply with exactly OK",
      config: {
        maxOutputTokens: 5,
      },
    });

    const durationMs = Date.now() - start;
    if (response.text && response.text.trim().toUpperCase().includes("OK")) {
      return {
        provider: "Gemini",
        status: "working",
        checkedAt: new Date().toISOString(),
        durationMs,
        httpStatus: 200,
        message: "Gemini response succeeded.",
        capabilities: ["AI Analysis Synthesis", "Factual Interpretation"],
      };
    }
    return {
      provider: "Gemini",
      status: "broken",
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: null,
      message: "Gemini returned an invalid response text: " + (response.text || "empty"),
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

    // Sanitize to not leak API keys
    const cleanMsg = msg.replace(key || "key-not-found", "REDACTED_API_KEY");

    return {
      provider: "Gemini",
      status,
      checkedAt: new Date().toISOString(),
      durationMs,
      httpStatus: null,
      message: cleanMsg,
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
        capabilities: ["Fallback AI Analysis", "Factual Interpretation"],
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

    // Sanitize to not leak API keys
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
      return "unsupported";
    case "timeout":
      return "timeout";
    case "network_error":
      return "network_error";
    default:
      return "broken";
  }
}
