import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCompanyAnalysis } from "@/src/lib/research/llmAnalysis";
import { EvidenceBundle } from "@/src/lib/research/buildEvidenceBundle";
import { CompanyMarketSnapshot } from "@/src/types/snapshot";
import { runGroqAnalysis } from "@/src/lib/providers/groq";

vi.mock("@/src/lib/providers/groq", () => ({
  runGroqAnalysis: vi.fn(),
}));

describe("Strict Groq Analysis Integration Tests", () => {
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
    categoryAssessments: {
      priceHistory: { status: "sufficient", daysCount: 600, reason: "Good history" },
      financialCapacity: { status: "strong", reason: "Good financials" },
      cashFlow: { status: "positive", reason: "Good cash flow" },
      news: { status: "positive", reason: "Positive sentiment" },
      marketValue: { status: "valued", marketCap: 15000000000, reason: "Valued market cap" },
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return Groq analysis if Groq succeeds", async () => {
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

    const res = await runCompanyAnalysis(dummyBundle, dummySnapshot, dummySnapshot.categoryAssessments);

    expect(res.status).toBe("success");
    expect(res.selectedProvider).toBe("groq");
    expect(res.data?.verdict).toBe("WATCH");
    expect(res.data?.finalScore).toBe(65);
    expect(runGroqAnalysis).toHaveBeenCalledOnce();
  });

  it("should return unavailable status and null data if Groq fails", async () => {
    vi.mocked(runGroqAnalysis).mockResolvedValue({
      provider: "groq",
      status: "timeout",
      durationMs: 300,
      model: "llama-3.3-70b-versatile",
      data: null,
      message: "Timeout error",
    });

    const res = await runCompanyAnalysis(dummyBundle, dummySnapshot, dummySnapshot.categoryAssessments);

    expect(res.status).toBe("unavailable");
    expect(res.analysisMode).toBe("unavailable");
    expect(res.selectedProvider).toBeNull();
    expect(res.data).toBeNull();
    expect(res.analysis).toBeNull();
    expect(res.attempts).toHaveLength(1);
    expect(res.attempts[0].provider).toBe("groq");
  });
});
