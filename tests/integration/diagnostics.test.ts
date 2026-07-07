import { describe, it, expect, vi, beforeEach } from "vitest";
import { runDiagnosticsPipeline } from "@/src/lib/research/fetchAllProviders";
import { fetchJson } from "@/src/lib/providers/shared/fetchJson";
import { CompanyIdentity } from "@/src/lib/company/symbolCandidates";
import { EndpointResult } from "@/src/lib/providers/shared/types";

vi.mock("@/src/lib/providers/shared/fetchJson", () => ({
  fetchJson: vi.fn(),
}));

describe("Diagnostics Pipeline Integration Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should run the parallel diagnostic pipeline successfully", async () => {
    const company: CompanyIdentity = {
      name: "Apple Inc.",
      displayTicker: "AAPL",
      canonicalTicker: "AAPL",
      exchange: "NASDAQ",
      country: "US",
      currency: "USD",
      isin: null,
    };

    // Mock fetchJson to return successful structure-compliant mock EndpointResults
    vi.mocked(fetchJson).mockImplementation(async (options: any): Promise<EndpointResult> => {
      const now = new Date().toISOString();
      let rawData: any = { test: true };

      if (options.provider === "FMP") {
        if (options.endpointName === "Profile") {
          rawData = [{ companyName: "Apple Inc.", symbol: "AAPL", price: 150 }];
        } else {
          rawData = [{ symbol: "AAPL", price: 150 }];
        }
      } else if (options.provider === "Finnhub") {
        if (options.endpointName === "Profile") {
          rawData = { name: "Apple Inc.", ticker: "AAPL" };
        } else {
          rawData = { c: 150 };
        }
      } else if (options.provider === "Twelve Data") {
        rawData = { symbol: "AAPL", price: "150" };
      } else if (options.provider === "EODHD") {
        rawData = { code: "AAPL", close: 150 };
      } else if (options.provider === "Alpha Vantage") {
        if (options.endpointName === "Quote") {
          rawData = { "Global Quote": { "01. symbol": "AAPL", "05. price": "150" } };
        } else {
          rawData = { "Time Series (Daily)": { "2026-07-06": { "4. close": "150" } } };
        }
      }

      return {
        provider: options.provider,
        endpointName: options.endpointName,
        status: "success",
        ok: true,
        startedAt: now,
        completedAt: now,
        durationMs: 10,
        httpStatus: 200,
        request: {
          endpoint: options.url,
          method: options.method || "GET",
          symbolRequested: options.symbolRequested || null,
          symbolUsed: options.symbolUsed || null,
          candidatesTried: options.candidatesTried || [],
          query: options.query || null,
        },
        response: {
          recordCount: 1,
          data: rawData,
          raw: rawData,
        },
        error: null,
      };
    });

    const res = await runDiagnosticsPipeline(company);

    // Verify overall status and structure
    expect(res.overallStatus).toBe("success");
    expect(res.providers).toHaveLength(7);
    expect(res.allEndpoints.length).toBeGreaterThan(5);

    // Check FMP symbol resolved
    const fmpProv = res.providers.find((p) => p.provider === "FMP");
    expect(fmpProv).toBeDefined();
    expect(fmpProv!.symbolUsed).toBe("AAPL");
    expect(fmpProv!.status).toBe("success");
  });

  it("should handle partial failures gracefully and report them", async () => {
    const company: CompanyIdentity = {
      name: "Reliance Industries",
      displayTicker: "RELIANCE",
      canonicalTicker: "RELIANCE.NS",
      exchange: "NSE",
      country: "India",
      currency: "INR",
      isin: null,
    };

    // Mock fetchJson to fail for Finnhub but succeed for others
    vi.mocked(fetchJson).mockImplementation(async (options: any): Promise<EndpointResult> => {
      const now = new Date().toISOString();
      const isFinnhub = options.provider === "Finnhub";
      
      let rawData: any = { test: true };

      if (!isFinnhub) {
        if (options.provider === "FMP") {
          rawData = [{ companyName: "Reliance Industries Limited", symbol: "RELIANCE.NS" }];
        } else if (options.provider === "Twelve Data") {
          rawData = { symbol: "RELIANCE", price: "2500" };
        } else if (options.provider === "EODHD") {
          rawData = { code: "RELIANCE.NSE", close: 2500 };
        } else if (options.provider === "Alpha Vantage") {
          if (options.endpointName === "Quote") {
            rawData = { "Global Quote": { "01. symbol": "RELIANCE.NS", "05. price": "2500" } };
          } else {
            rawData = { "Time Series (Daily)": { "2026-07-06": { "4. close": "2500" } } };
          }
        }
      }

      return {
        provider: options.provider,
        endpointName: options.endpointName,
        status: isFinnhub ? "rate_limit" : "success",
        ok: !isFinnhub,
        startedAt: now,
        completedAt: now,
        durationMs: 15,
        httpStatus: isFinnhub ? 429 : 200,
        request: {
          endpoint: options.url,
          method: options.method || "GET",
          symbolRequested: options.symbolRequested || null,
          symbolUsed: options.symbolUsed || null,
          candidatesTried: options.candidatesTried || [],
          query: options.query || null,
        },
        response: {
          recordCount: isFinnhub ? 0 : 1,
          data: isFinnhub ? null : rawData,
          raw: isFinnhub ? null : rawData,
        },
        error: isFinnhub ? { code: "RATE_LIMIT", message: "API limit reached for Finnhub" } : null,
      };
    });

    const res = await runDiagnosticsPipeline(company);

    // If any provider is rate limited, overallStatus should reflect that (rate_limit or partial)
    expect(res.overallStatus).toBe("rate_limit");

    const finnhubProv = res.providers.find((p) => p.provider === "Finnhub");
    expect(finnhubProv!.status).toBe("rate_limit");

    const fmpProv = res.providers.find((p) => p.provider === "FMP");
    expect(fmpProv!.status).toBe("success");
  });
});
