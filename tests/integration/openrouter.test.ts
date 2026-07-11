import { describe, it, expect, vi, beforeEach } from "vitest";
import { runOpenRouterAnalysis } from "@/src/services/openrouter";
import { runGeminiAnalysis } from "@/src/lib/providers/gemini";
import { ChatOpenAI } from "@langchain/openai";
import { EvidenceBundle } from "@/src/lib/research/buildEvidenceBundle";
import { CompanyMarketSnapshot } from "@/src/types/snapshot";

// Mock env module
vi.mock("@/src/lib/env", () => ({
  getOpenRouterApiKey: () => "mock_openrouter_key",
  getOpenRouterModel: () => "deepseek/deepseek-chat:free",
}));

// Mock ChatOpenAI from @langchain/openai
const mockOpenRouterInvoke = vi.fn();
vi.mock("@langchain/openai", () => {
  return {
    ChatOpenAI: class {
      constructor() {}
      withStructuredOutput = () => {
        return {
          invoke: mockOpenRouterInvoke,
        };
      };
    },
  };
});

describe("OpenRouter Provider & Gemini Mock Integration Tests", () => {
  const dummyBundle: EvidenceBundle = {
    company: { name: "Test Corp", ticker: "TEST", exchange: "NYSE", country: "US" },
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
    company: { name: "Test Corp", ticker: "TEST", exchange: "NYSE", country: "US", sector: null, industry: null, description: null, currency: "USD" },
    market: { price: 100, change: 0, changePercent: 0, high: 100, low: 100, previousClose: 100, volume: 100, marketCap: 1000000, sharesOutstanding: null, pe: 10, pb: null, eps: 10 },
    history: { return30dPercent: 0, historyLength: 30 },
    financials: [],
    news: [],
    web: { answer: null, results: [] },
    providers: [],
    categoryAssessments: {
      priceHistory: { status: "sufficient", daysCount: 600, reason: "Good" },
      financialCapacity: { status: "strong", reason: "Good" },
      cashFlow: { status: "positive", reason: "Good" },
      news: { status: "positive", reason: "Good" },
      marketValue: { status: "valued", marketCap: 1000000, reason: "Good" },
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should successfully call OpenRouter and return structured data", async () => {
    mockOpenRouterInvoke.mockResolvedValue({
      investmentScore: 92,
      verdict: "INVEST",
      confidence: 88,
      pros: ["Consistent revenue growth"],
      cons: ["High R&D cost"],
      riskFactors: ["Competition"],
      summary: "Looks like a buy",
      evidenceStrength: "Strong balance sheet and operating cash flows.",
      evidenceConsistency: "Metrics align across all categories.",
      majorSupportingFactors: ["Consistent revenue growth"],
      majorConcerns: ["High R&D cost"],
      keyRisks: ["Competition"],
      missingEvidence: [],
      decisionRationale: "Looks like a buy",
      overallConfidence: 88,
      finalVerdict: "INVEST",
    });

    const res = await runOpenRouterAnalysis(dummyBundle, dummySnapshot, dummySnapshot.categoryAssessments);

    expect(res.status).toBe("success");
    expect(res.data?.verdict).toBe("INVEST");
    expect(res.data?.investmentScore).toBe(92);
    expect(res.data?.pros[0]).toBe("Consistent revenue growth");
  });

  it("should retry and eventually fail with timeout if OpenRouter times out", async () => {
    mockOpenRouterInvoke.mockRejectedValue(new Error("Timeout calling OpenRouter"));

    const res = await runOpenRouterAnalysis(dummyBundle, dummySnapshot, dummySnapshot.categoryAssessments);

    expect(res.status).toBe("timeout");
    expect(res.data).toBeNull();
  });

  it("should run Gemini mock and return high score when categories are strong", async () => {
    const res = await runGeminiAnalysis(dummyBundle, dummySnapshot, dummySnapshot.categoryAssessments);

    expect(res.status).toBe("success");
    expect(res.data?.verdict).toBe("INVEST");
    expect(res.data?.investmentScore).toBe(85);
  });

  it("should run Gemini mock and return pass when categories are weak", async () => {
    const weakSnapshot = {
      ...dummySnapshot,
      categoryAssessments: {
        ...dummySnapshot.categoryAssessments,
        financialCapacity: { status: "weak" as const, reason: "Too much debt" },
      },
    };

    const res = await runGeminiAnalysis(dummyBundle, weakSnapshot, weakSnapshot.categoryAssessments);

    expect(res.status).toBe("success");
    expect(res.data?.verdict).toBe("PASS");
    expect(res.data?.investmentScore).toBe(45);
  });
});
