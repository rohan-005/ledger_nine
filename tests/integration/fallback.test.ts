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
    company: {
      name: "Reliance Industries",
      ticker: "RELIANCE.NS",
      exchange: "NSE",
      country: "India",
      sector: null,
      industry: null,
      description: null,
      currency: "INR",
    },
    market: {
      price: 2500,
      change: 10,
      changePercent: 0.4,
      high: 2800,
      low: 2200,
      previousClose: 2490,
      volume: 100000,
      marketCap: 15000000000,
      sharesOutstanding: null,
      pe: 25,
      pb: null,
      eps: 100,
    },
    history: {
      return30dPercent: 5,
      historyLength: 30,
    },
    financials: [],
    news: [],
    web: {
      answer: null,
      results: [],
    },
    providers: [],
  };

  const dummySignals: SignalsBreakdown = {
    priceMomentum: 70,
    valuation: 60,
    financialQuality: 80,
    newsContext: 90,
    dataConfidence: 95,
    finalDeterministicScore: 78,
    deterministicVerdict: "INVEST",
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
