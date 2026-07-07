import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCompanyAnalysis } from "@/src/lib/research/llmAnalysis";
import { EvidenceBundle } from "@/src/lib/research/buildEvidenceBundle";
import { CompanyMarketSnapshot, SignalsBreakdown } from "@/src/types/snapshot";
import { runGeminiAnalysis } from "@/src/lib/providers/gemini";
import { runGroqAnalysis } from "@/src/lib/providers/groq";

vi.mock("@/src/lib/providers/gemini", () => ({
  runGeminiAnalysis: vi.fn(),
  analysisSchema: {
    parse: (x: any) => x,
  },
}));

vi.mock("@/src/lib/providers/groq", () => ({
  runGroqAnalysis: vi.fn(),
}));

describe("Strict Fallback Chain Integration Tests", () => {
  const dummyBundle: EvidenceBundle = {
    company: {
      name: "Reliance Industries",
      ticker: "RELIANCE.NS",
      exchange: "NSE",
      country: "IN",
      currency: "INR",
      isin: null,
    },
    companyProfiles: [],
    quotes: [],
    financialStatements: [],
    metrics: [],
    ratios: [],
    historicalPrices: [],
    news: [],
    webResearch: [],
    providerHealth: {},
    providerFailures: [],
    evidenceIndex: {},
  };

  const dummySnapshot: CompanyMarketSnapshot = {
    ticker: "RELIANCE.NS",
    companyName: "Reliance Industries",
    exchange: "NSE",
    country: "IN",
    marketCap: null,
    price: 2500,
    change: 10,
    changePercent: 0.4,
    currency: "INR",
    yearHigh: 2800,
    yearLow: 2200,
    peRatio: 25,
    eps: 100,
    volume: 100000,
    revenue: 800000,
    netIncome: 60000,
    grossMargin: 20,
    operatingMargin: 15,
    netMargin: 7.5,
    debtToEquity: 0.4,
    currentRatio: 1.2,
    roe: 12,
    freeCashFlow: 40000,
    dividendYield: 0.5,
  };

  const dummySignals: SignalsBreakdown = {
    priceMomentum: { score: 70, rating: "NEUTRAL", detail: "neutral" },
    valuation: { score: 60, rating: "NEUTRAL", detail: "neutral" },
    financialQuality: { score: 80, rating: "STRONG", detail: "strong" },
    newsSentiment: { score: 90, rating: "STRONG", detail: "strong" },
    dataConfidence: { score: 95, rating: "STRONG", detail: "strong" },
    deterministicVerdict: "INVEST",
    finalDeterministicScore: 78,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return Gemini analysis if Gemini succeeds", async () => {
    vi.mocked(runGeminiAnalysis).mockResolvedValue({
      provider: "gemini",
      status: "success",
      durationMs: 120,
      model: "gemini-2.5-flash",
      data: {
        companySummary: "Gemini Summary",
        financialInterpretation: "Financial Details",
        marketInterpretation: "Market Details",
        newsInterpretation: "News Details",
        webResearchInterpretation: "Web Details",
        strengths: ["Strong growth"],
        concerns: ["Debt"],
        conflicts: [],
        evidenceGaps: [],
        overallSummary: "Gemini Overall Summary",
        citedEvidenceIds: [],
        verdict: "INVEST",
        finalScore: 85,
      },
    });

    const res = await runCompanyAnalysis(dummyBundle, dummySnapshot, dummySignals);

    expect(res.status).toBe("success");
    expect(res.selectedProvider).toBe("gemini");
    expect(res.data?.verdict).toBe("INVEST");
    expect(res.data?.finalScore).toBe(85);
    expect(runGroqAnalysis).not.toHaveBeenCalled();
  });

  it("should fall back to Groq if Gemini fails but Groq succeeds", async () => {
    vi.mocked(runGeminiAnalysis).mockResolvedValue({
      provider: "gemini",
      status: "rate_limit",
      durationMs: 50,
      model: "gemini-2.5-flash",
      data: null,
      message: "Rate limit hit",
    });

    vi.mocked(runGroqAnalysis).mockResolvedValue({
      provider: "groq",
      status: "success",
      durationMs: 250,
      model: "llama-3.3-70b-versatile",
      data: {
        companySummary: "Groq Summary",
        financialInterpretation: "Financial Details",
        marketInterpretation: "Market Details",
        newsInterpretation: "News Details",
        webResearchInterpretation: "Web Details",
        strengths: ["Strong cash flow"],
        concerns: ["Valuation"],
        conflicts: [],
        evidenceGaps: [],
        overallSummary: "Groq Overall Summary",
        citedEvidenceIds: [],
        verdict: "WATCH",
        finalScore: 65,
      },
    });

    const res = await runCompanyAnalysis(dummyBundle, dummySnapshot, dummySignals);

    expect(res.status).toBe("success");
    expect(res.selectedProvider).toBe("groq");
    expect(res.data?.verdict).toBe("WATCH");
    expect(res.data?.finalScore).toBe(65);
  });

  it("should return unavailable status and null data if both Gemini and Groq fail", async () => {
    vi.mocked(runGeminiAnalysis).mockResolvedValue({
      provider: "gemini",
      status: "provider_error",
      durationMs: 60,
      model: "gemini-2.5-flash",
      data: null,
      message: "Internal error",
    });

    vi.mocked(runGroqAnalysis).mockResolvedValue({
      provider: "groq",
      status: "timeout",
      durationMs: 300,
      model: "llama-3.3-70b-versatile",
      data: null,
      message: "Timeout error",
    });

    const res = await runCompanyAnalysis(dummyBundle, dummySnapshot, dummySignals);

    expect(res.status).toBe("unavailable");
    expect(res.analysisMode).toBe("unavailable");
    expect(res.selectedProvider).toBeNull();
    expect(res.data).toBeNull();
    expect(res.analysis).toBeNull();
    expect(res.attempts).toHaveLength(2);
    expect(res.attempts[0].provider).toBe("gemini");
    expect(res.attempts[1].provider).toBe("groq");
  });
});
