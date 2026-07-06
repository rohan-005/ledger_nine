import { describe, it, expect, vi, beforeEach } from "vitest";
import { researchCoordinator } from "@/src/core/coordinator/research-coordinator";
import { runContradictionDetector, synthesizeResearchReport } from "@/src/core/consensus/consensus";
import { researchRepository } from "@/src/db/repositories/research.repository";
import { scoreRepository } from "@/src/db/repositories/score.repository";
import { contradictionRepository } from "@/src/db/repositories/contradiction.repository";
import { reportRepository } from "@/src/db/repositories/report.repository";
import { fmpClient } from "@/src/integrations/fmp/fmp.client";
import { llmRouter } from "@/src/core/llm/llm-router";
import { Evidence } from "@/src/core/evidence/evidence.types";

// Mock the integrations
vi.mock("@/src/integrations/fmp/fmp.client", () => ({
  fmpClient: {
    getCompanyProfile: vi.fn().mockResolvedValue({ symbol: "AAPL", companyName: "Apple Inc." }),
  },
}));

// Mock the LLM router
vi.mock("@/src/core/llm/llm-router", () => ({
  llmRouter: {
    generateText: vi.fn(),
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
    ]),
    upsertAgentRun: vi.fn().mockResolvedValue({}),
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

// Mock the specialist orchestrator
vi.mock("@/src/core/agents/orchestrator", () => ({
  orchestrateSpecialists: vi.fn().mockResolvedValue([
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
      claim: "Strong moat",
      category: "business",
      sourceType: "fmp",
      confidence: 1.0,
      sourceQuality: 1.0,
      agentId: "business",
      createdAt: new Date().toISOString(),
    },
    {
      id: "ev_3",
      researchId: "run_abc",
      claim: "Fair valuation",
      category: "valuation",
      sourceType: "sec",
      confidence: 1.0,
      sourceQuality: 1.0,
      agentId: "valuation",
      createdAt: new Date().toISOString(),
    },
  ]),
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
      // Orchestrator returns empty evidence (agents all failed)
      const orchestratorMod = await import("@/src/core/agents/orchestrator");
      vi.mocked(orchestratorMod.orchestrateSpecialists).mockResolvedValueOnce([]);

      // agentRuns reflect provider failures
      const agentRunMod = await import("@/src/db/repositories/agent-run.repository");
      vi.mocked(agentRunMod.agentRunRepository.getAgentRunsByResearchId).mockResolvedValueOnce([
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
      const orchestratorMod = await import("@/src/core/agents/orchestrator");
      vi.mocked(orchestratorMod.orchestrateSpecialists).mockResolvedValueOnce([]);

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
