import { describe, it, expect, vi, beforeEach } from "vitest";
import { researchGraph } from "@/src/lib/research/researchGraph";
import { runDiagnosticsPipeline } from "@/src/lib/research/fetchAllProviders";
import { runAllProviderHealthChecks } from "@/src/lib/providers/healthCheck";

// Mock env module first
vi.mock("@/src/lib/env", () => ({
  getGroqApiKey: () => "fake_groq_api_key",
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
const mockInvoke = vi.fn();
vi.mock("@langchain/groq", () => {
  return {
    ChatGroq: class {
      withStructuredOutput = () => {
        return {
          invoke: mockInvoke,
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

    // 3. Mock ChatGroq invoke response
    mockInvoke.mockResolvedValue({
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
      verdict: "INVEST",
      finalScore: 85,
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
    expect(result.analysisRunResult?.data?.finalScore).toBe(85);
  });

  it("should route to finalizeReport and force PASS verdict when Groq fails", async () => {
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

    // Groq throws an error
    mockInvoke.mockRejectedValue(new Error("Groq API Timeout"));

    const result = await researchGraph.invoke({
      ticker: "AAPL",
    });

    // Graph sets status = "unavailable"
    expect(result.status).toBe("unavailable");
    // Graph falls back to PASS verdict
    expect(result.verdict).toBe("PASS");
    expect(result.analysisRunResult).toBeDefined();
    expect(result.analysisRunResult?.status).toBe("unavailable");
    expect(result.analysisRunResult?.data).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("LangChain + ChatGroq execution failed");
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
