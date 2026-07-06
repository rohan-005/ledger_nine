import { describe, it, expect, vi, beforeEach } from "vitest";
import { researchCoordinator } from "@/src/core/coordinator/research-coordinator";
import { runContradictionDetector, synthesizeResearchReport } from "@/src/core/consensus/consensus";
import { researchRepository } from "@/src/db/repositories/research.repository";
import { scoreRepository } from "@/src/db/repositories/score.repository";
import { contradictionRepository } from "@/src/db/repositories/contradiction.repository";
import { reportRepository } from "@/src/db/repositories/report.repository";
import { agentRunRepository } from "@/src/db/repositories/agent-run.repository";
import { fmpClient } from "@/src/integrations/fmp/fmp.client";
import { newsapiClient } from "@/src/lib/services/newsapi";
import { tavilyClient } from "@/src/integrations/tavily/tavily.client";
import { llmRouter } from "@/src/core/llm/llm-router";
import { Evidence } from "@/src/core/evidence/evidence.types";

// Mock the integrations
vi.mock("@/src/integrations/fmp/fmp.client", () => ({
  fmpClient: {
    getCompanyProfile: vi.fn().mockResolvedValue({ symbol: "AAPL", companyName: "Apple Inc.", exchange: "NASDAQ", country: "US" }),
    getIncomeStatements: vi.fn().mockResolvedValue([
      { date: "2023-12-31", revenue: 383285000000, grossProfit: 169148000000, operatingIncome: 114301000000, netIncome: 96995000000, interestExpense: 3933000000 },
      { date: "2022-12-31", revenue: 394328000000, grossProfit: 170782000000, operatingIncome: 119437000000, netIncome: 99803000000, interestExpense: 2931000000 },
      { date: "2021-12-31", revenue: 365817000000, grossProfit: 152837000000, operatingIncome: 108949000000, netIncome: 94680000000, interestExpense: 2645000000 }
    ]),
    getBalanceSheets: vi.fn().mockResolvedValue([
      { date: "2023-12-31", totalAssets: 352583000000, totalLiabilities: 290437000000, totalStockholdersEquity: 62146000000, totalDebt: 111088000000 },
      { date: "2022-12-31", totalAssets: 352755000000, totalLiabilities: 302083000000, totalStockholdersEquity: 50672000000, totalDebt: 120069000000 },
      { date: "2021-12-31", totalAssets: 351002000000, totalLiabilities: 287912000000, totalStockholdersEquity: 63090000000, totalDebt: 124719000000 }
    ]),
    getCashFlowStatements: vi.fn().mockResolvedValue([
      { date: "2023-12-31", netCashProvidedByOperatingActivities: 110543000000, capitalExpenditure: 10959000000, freeCashFlow: 99584000000 },
      { date: "2022-12-31", netCashProvidedByOperatingActivities: 122151000000, capitalExpenditure: 10708000000, freeCashFlow: 111443000000 },
      { date: "2021-12-31", netCashProvidedByOperatingActivities: 104038000000, capitalExpenditure: 11085000000, freeCashFlow: 92953000000 }
    ]),
    getQuote: vi.fn().mockResolvedValue({ price: 150.0, pe: 30.0, enterpriseValueOverEBITDA: 25.0, marketCap: 2500000000000 }),
  },
}));

vi.mock("@/src/lib/services/finnhub", () => ({
  finnhubClient: {
    getCompanyProfile: vi.fn().mockResolvedValue({ name: "Apple Inc.", exchange: "NASDAQ", country: "US" }),
    getQuote: vi.fn().mockResolvedValue({ c: 150.0 }),
    getCompanyNews: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/src/lib/services/newsapi", () => ({
  newsapiClient: {
    searchEverything: vi.fn().mockResolvedValue({
      articles: [
        { title: "Apple reports strong earnings", description: "Apple has exceeded growth expectations.", source: { name: "Reuters" } }
      ]
    }),
  },
}));

vi.mock("@/src/integrations/tavily/tavily.client", () => ({
  tavilyClient: {
    search: vi.fn().mockResolvedValue({ results: [] }),
  },
}));

vi.mock("@/src/lib/services/gemini", () => ({
  geminiClient: {
    generateText: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        businessQualityMoat: "wide",
        businessQualityReasoning: "Strong moat",
        competitivePosition: "leader",
        competitivePositionReasoning: "Leader in hardware",
        managementGovernance: "excellent",
        managementGovernanceReasoning: "Excellent capital allocation",
        riskExposure: "low",
        riskReasoning: "Low business risk",
        thesis: "AAPL is a strong buy.",
        bullCase: ["Moat is wide", "Services revenue growing"],
        bearCase: ["Hardware sales slowing"],
        keyRisks: ["Regulatory scrutiny"],
        summary: "Overall very positive company.",
      }),
      latencyMs: 100,
      model: "mock-model",
      provider: "mock-provider",
    }),
  },
}));

// Mock the LLM router
vi.mock("@/src/core/llm/llm-router", () => ({
  llmRouter: {
    generateText: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        contradictions: [],
      }),
    }),
  },
}));

// Mock database repositories
vi.mock("@/src/db/repositories/research.repository", () => ({
  researchRepository: {
    createRun: vi.fn().mockResolvedValue({}),
    updateStatus: vi.fn().mockResolvedValue({}),
    updateCurrentNode: vi.fn().mockResolvedValue({}),
    markCompleted: vi.fn().mockResolvedValue({}),
    markFailed: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/src/db/repositories/agent-run.repository", () => ({
  agentRunRepository: {
    getAgentRunsByResearchId: vi.fn().mockResolvedValue([
      { agentId: "sec", status: "completed" },
      { agentId: "financial", status: "completed" },
      { agentId: "macro", status: "completed" },
      { agentId: "earnings", status: "completed" },
    ]),
    startAgentRun: vi.fn().mockResolvedValue({}),
    completeAgentRun: vi.fn().mockResolvedValue({}),
    failAgentRun: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/src/db/repositories/evidence.repository", () => ({
  evidenceRepository: {
    insertManyEvidence: vi.fn().mockResolvedValue([]),
    insertEvidence: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/src/db/repositories/score.repository", () => ({
  scoreRepository: {
    upsertScore: vi.fn().mockImplementation((score) => Promise.resolve(score)),
  },
}));

vi.mock("@/src/db/repositories/contradiction.repository", () => ({
  contradictionRepository: {
    insertContradictions: vi.fn().mockImplementation((cts) => Promise.resolve(cts)),
  },
}));

vi.mock("@/src/db/repositories/report.repository", () => ({
  reportRepository: {
    upsertReport: vi.fn().mockImplementation((rep) => Promise.resolve(rep)),
  },
}));

describe("Consensus Engine & Research Coordinator Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Contradiction Detector", () => {
    it("should return empty if evidence count is less than 2", async () => {
      const result = await runContradictionDetector("run_abc", "AAPL", []);
      expect(result).toEqual([]);
      expect(llmRouter.generateText).not.toHaveBeenCalled();
    });

    it("should successfully call LLM and parse contradictions", async () => {
      vi.mocked(llmRouter.generateText).mockResolvedValueOnce({
        text: JSON.stringify({
          contradictions: [
            {
              evidenceIdA: "ev_1",
              evidenceIdB: "ev_2",
              description: "Revenue statements conflict",
              severity: "medium",
              confidence: 0.85,
            },
          ],
        }),
        latencyMs: 100,
        model: "mock-model",
        provider: "mock-provider",
      });

      const mockEvidence: Evidence[] = [
        {
          id: "ev_1",
          researchId: "run_abc",
          claim: "Strong revenues",
          category: "financial",
          sourceType: "sec",
          confidence: 1.0,
          sourceQuality: 1.0,
          agentId: "financial",
          createdAt: new Date().toISOString(),
        },
        {
          id: "ev_2",
          researchId: "run_abc",
          claim: "Declining revenues",
          category: "financial",
          sourceType: "sec",
          confidence: 0.9,
          sourceQuality: 0.9,
          agentId: "sec",
          createdAt: new Date().toISOString(),
        },
      ];

      const result = await runContradictionDetector("run_abc", "AAPL", mockEvidence);
      expect(result.length).toBe(1);
      expect(result[0].evidenceIdA).toBe("ev_1");
      expect(result[0].evidenceIdB).toBe("ev_2");
      expect(result[0].severity).toBe("medium");
      expect(result[0].confidence).toBe("0.85");
      expect(contradictionRepository.insertContradictions).toHaveBeenCalled();
    });
  });

  describe("Report Synthesizer", () => {
    it("should successfully call LLM and generate research report", async () => {
      vi.mocked(llmRouter.generateText).mockResolvedValueOnce({
        text: JSON.stringify({
          thesis: "AAPL is a strong buy.",
          bullCase: ["Moat is wide", "Services revenue growing"],
          bearCase: ["Hardware sales slowing"],
          keyRisks: ["Regulatory scrutiny"],
          summary: "Overall very positive company.",
        }),
        latencyMs: 100,
        model: "mock-model",
        provider: "mock-provider",
      });

      const mockScores = {
        business: 80,
        financial: 90,
        valuation: 70,
        news: 85,
        risk: 80,
        evidenceQuality: 95,
        contradictionPenalty: 0,
        final: 83.5,
        decision: "INVEST" as const,
        contributionLedger: [],
      };

      const result = await synthesizeResearchReport("run_abc", "AAPL", [], mockScores);
      expect(result.report.thesis).toBe("AAPL is a strong buy.");
      expect(JSON.parse(result.report.bullCase)).toContain("Moat is wide");
      expect(JSON.parse(result.report.keyRisks)).toContain("Regulatory scrutiny");
      expect(reportRepository.upsertReport).toHaveBeenCalled();
    });
  });

  describe("Research Coordinator Pipeline", () => {
    it("should coordinate a full pipeline execution successfully", async () => {
      // Mock contradiction detector LLM
      vi.mocked(llmRouter.generateText).mockResolvedValue({
        text: JSON.stringify({
          contradictions: [],
          thesis: "Thesis text",
          bullCase: ["Bull item"],
          bearCase: ["Bear item"],
          keyRisks: ["Risk item"],
          summary: "Summary text",
        }),
        latencyMs: 50,
        model: "mock-model",
        provider: "mock-provider",
      });

      await researchCoordinator.executeResearch("run_abc", "AAPL", "3-5 years", "moderate");

      expect(researchRepository.updateStatus).toHaveBeenCalledWith("run_abc", "running");
      expect(researchRepository.updateCurrentNode).toHaveBeenCalledWith("run_abc", "specialists");
      expect(researchRepository.updateCurrentNode).toHaveBeenCalledWith("run_abc", "contradictions");
      expect(researchRepository.updateCurrentNode).toHaveBeenCalledWith("run_abc", "scoring");
      expect(researchRepository.updateCurrentNode).toHaveBeenCalledWith("run_abc", "committee");
      expect(scoreRepository.upsertScore).toHaveBeenCalled();
      expect(researchRepository.markCompleted).toHaveBeenCalledWith(
        "run_abc",
        "Apple Inc.",
        "sufficient",
        [],
        [],
        "completed"
      );
    });

    it("should persist outcome=insufficient_evidence when agents fail but gate executes", async () => {
      // Mock APIs to return empty/fail
      vi.mocked(fmpClient.getIncomeStatements).mockResolvedValueOnce([]);
      vi.mocked(fmpClient.getBalanceSheets).mockResolvedValueOnce([]);
      vi.mocked(fmpClient.getCashFlowStatements).mockResolvedValueOnce([]);

      // agentRuns reflect provider failures
      vi.mocked(agentRunRepository.getAgentRunsByResearchId).mockResolvedValueOnce([
        { agentId: "financial", status: "failed", errorMessage: "rate limit" } as any,
        { agentId: "sec", status: "failed", errorMessage: "rate limit" } as any,
        { agentId: "macro", status: "completed", errorMessage: null } as any,
      ] as any[]);

      vi.mocked(llmRouter.generateText).mockResolvedValue({
        text: JSON.stringify({ contradictions: [] }),
        latencyMs: 10,
        model: "mock-model",
        provider: "mock-provider",
      });

      await researchCoordinator.executeResearch("run_abc", "AAPL", "3-5 years", "moderate");

      const calls = vi.mocked(researchRepository.markCompleted).mock.calls;
      const lastCall = calls[calls.length - 1];

      // Outcome must be insufficient_evidence — NEVER interrupted
      expect(lastCall[2]).toBe("insufficient_evidence");
      // Lifecycle status must be completed (pipeline ran to terminal state normally)
      expect(lastCall[5]).toBe("completed");
      // Synthesis must NOT have been triggered
      expect(researchRepository.updateCurrentNode).not.toHaveBeenCalledWith("run_abc", "committee");
    });

    it("should persist null scores when gate is insufficient", async () => {
      // Mock APIs to return empty/fail
      vi.mocked(fmpClient.getIncomeStatements).mockResolvedValueOnce([]);
      vi.mocked(fmpClient.getBalanceSheets).mockResolvedValueOnce([]);
      vi.mocked(fmpClient.getCashFlowStatements).mockResolvedValueOnce([]);
      vi.mocked(newsapiClient.searchEverything).mockResolvedValueOnce({ articles: [] });
      vi.mocked(tavilyClient.search).mockResolvedValueOnce({ results: [] });

      vi.mocked(llmRouter.generateText).mockResolvedValue({
        text: JSON.stringify({ contradictions: [] }),
        latencyMs: 10,
        model: "mock-model",
        provider: "mock-provider",
      });

      await researchCoordinator.executeResearch("run_abc", "AAPL", "3-5 years", "moderate");

      expect(scoreRepository.upsertScore).toHaveBeenCalled();
      const scoreCalls = vi.mocked(scoreRepository.upsertScore).mock.calls;
      const scoreArgs = scoreCalls[scoreCalls.length - 1][0];
      // All scored numeric values must be null when gate blocks synthesis
      expect(scoreArgs.finalScore).toBeNull();
      expect(scoreArgs.decision).toBeNull();
    });
  });
});
