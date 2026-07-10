import { describe, it, expect, vi, beforeEach } from "vitest";
import { researchGraph } from "@/src/lib/research/researchGraph";
import { runDiagnosticsPipeline } from "@/src/lib/research/fetchAllProviders";
import { runAllProviderHealthChecks } from "@/src/lib/providers/healthCheck";

// Mock env module first
vi.mock("@/src/lib/env", () => ({
  getGroqApiKey: () => "fake_groq_api_key",
  getOpenRouterApiKey: () => "fake_openrouter_api_key",
  getOpenRouterModel: () => "fake_model",
}));

// Mock fetchAllProviders
vi.mock("@/src/lib/research/fetchAllProviders", () => ({
  runDiagnosticsPipeline: vi.fn(),
}));

// Mock healthCheck
vi.mock("@/src/lib/providers/healthCheck", () => ({
  runAllProviderHealthChecks: vi.fn(),
}));

// Mock ChatGroq from @langchain/groq
const mockGroqInvoke = vi.fn();
vi.mock("@langchain/groq", () => {
  return {
    ChatGroq: class {
      withStructuredOutput = () => {
        return {
          invoke: mockGroqInvoke,
        };
      };
    },
  };
});

// Mock ChatOpenAI from @langchain/openai
const mockOpenRouterInvoke = vi.fn();
vi.mock("@langchain/openai", () => {
  return {
    ChatOpenAI: class {
      withStructuredOutput = () => {
        return {
          invoke: mockOpenRouterInvoke,
        };
      };
    },
  };
});

describe("LangGraph Research Graph Integration Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should run the full graph successfully when all steps succeed", async () => {
    // 1. Mock runDiagnosticsPipeline
    vi.mocked(runDiagnosticsPipeline).mockResolvedValue({
      company: { name: "Apple Inc", displayTicker: "AAPL", canonicalTicker: "AAPL" } as any,
      overallStatus: "success",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 120,
      providers: [],
      allEndpoints: [],
    });

    // 2. Mock runAllProviderHealthChecks
    vi.mocked(runAllProviderHealthChecks).mockResolvedValue({
      overallHealthy: true,
      statusMap: {},
      rawHealthResults: [],
    });

    // 3. Mock OpenRouter response
    mockOpenRouterInvoke.mockResolvedValue({
      investmentScore: 90,
      verdict: "INVEST",
      confidence: 95,
      pros: ["Strong cash flow"],
      cons: ["High valuation"],
      riskFactors: ["Market competition"],
      summary: "OpenRouter Overall Summary",
    });

    // 4. Mock Groq response
    mockGroqInvoke.mockResolvedValue({
      investmentScore: 80,
      verdict: "INVEST",
      confidence: 85,
      pros: ["Strong cash flow"],
      cons: ["High valuation"],
      riskFactors: ["Market competition"],
      summary: "Groq Overall Summary",
    });

    const result = await researchGraph.invoke({
      ticker: "AAPL",
    });

    expect(result.status).toBe("success");
    expect(result.verdict).toBe("INVEST");
    expect(result.completeness).toBeDefined();
    expect(result.completeness?.score).toBeGreaterThan(0);
    expect(result.snapshot).toBeDefined();
    expect(result.evidenceBundle).toBeDefined();
    expect(result.analysisRunResult).toBeDefined();
    expect(result.analysisRunResult?.status).toBe("success");
    expect(result.analysisRunResult?.data?.verdict).toBe("INVEST");
    expect(result.analysisRunResult?.data?.finalScore).toBe(72); // average of 90 (OpenRouter), 80 (Groq), and 45 (mock Gemini) is 72
  });

  it("should fallback to Groq when OpenRouter fails", async () => {
    vi.mocked(runDiagnosticsPipeline).mockResolvedValue({
      company: { name: "Apple Inc", displayTicker: "AAPL", canonicalTicker: "AAPL" } as any,
      overallStatus: "success",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 120,
      providers: [],
      allEndpoints: [],
    });

    vi.mocked(runAllProviderHealthChecks).mockResolvedValue({
      overallHealthy: true,
      statusMap: {},
      rawHealthResults: [],
    });

    // OpenRouter fails
    mockOpenRouterInvoke.mockRejectedValue(new Error("OpenRouter timeout"));

    // Groq succeeds
    mockGroqInvoke.mockResolvedValue({
      investmentScore: 70,
      verdict: "PASS",
      confidence: 75,
      pros: ["Good assets"],
      cons: ["Valuation pressure"],
      riskFactors: ["Macro risks"],
      summary: "Groq Fallback Summary",
    });

    const result = await researchGraph.invoke({
      ticker: "AAPL",
    });

    // Overall verdict from Groq (PASS) + Gemini (PASS) consensus is PASS
    expect(result.status).toBe("success"); // consensus was reached with fallbacks
    expect(result.verdict).toBe("PASS");
    expect(result.analysisRunResult?.status).toBe("success");
    expect(result.analysisRunResult?.selectedProvider).toBe("groq");
    expect(result.analysisRunResult?.data?.verdict).toBe("PASS");
  });

  it("should route to finalizeReport immediately if company cannot be resolved", async () => {
    const result = await researchGraph.invoke({
      ticker: "", // Empty ticker will fail resolution
    });

    expect(result.status).toBe("unavailable");
    expect(result.verdict).toBe("PASS");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Failed to resolve company identity");
  });
});
