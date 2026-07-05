import { describe, it, expect, vi, beforeEach } from "vitest";
import { orchestrateSpecialists } from "@/src/core/agents/orchestrator";
import { fmpClient } from "@/src/integrations/fmp/fmp.client";
import { secClient } from "@/src/integrations/sec/sec.client";
import { tavilyClient } from "@/src/integrations/tavily/tavily.client";
import { alphaVantageClient } from "@/src/integrations/alpha-vantage/alpha-vantage.client";
import { agentRunRepository } from "@/src/db/repositories/agent-run.repository";
import { evidenceRepository } from "@/src/db/repositories/evidence.repository";

// Mock the integrations
vi.mock("@/src/integrations/fmp/fmp.client", () => ({
  fmpClient: {
    getCompanyProfile: vi.fn().mockResolvedValue({ cik: "0000320193" }),
    getQuote: vi.fn().mockResolvedValue({ price: 150 }),
    getIncomeStatements: vi.fn().mockResolvedValue([]),
    getBalanceSheets: vi.fn().mockResolvedValue([]),
    getCashFlowStatements: vi.fn().mockResolvedValue([]),
    getKeyMetrics: vi.fn().mockResolvedValue([]),
    getFinancialRatios: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/src/integrations/sec/sec.client", () => ({
  secClient: {
    getSubmissions: vi.fn().mockResolvedValue({}),
    getCompanyFacts: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/src/integrations/tavily/tavily.client", () => ({
  tavilyClient: {
    search: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/src/integrations/alpha-vantage/alpha-vantage.client", () => ({
  alphaVantageClient: {
    getEarnings: vi.fn().mockResolvedValue({}),
  },
}));

// Mock the LLM router
vi.mock("@/src/core/llm/llm-router", () => ({
  llmRouter: {
    generateText: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        evidence: [
          {
            claim: "Test Claim",
            category: "financial",
            rawValue: "Value 123",
            confidence: 0.9,
            sourceQuality: 0.9,
          },
        ],
      }),
      latencyMs: 100,
      model: "mock-model",
      provider: "mock-provider",
    }),
  },
}));

// Mock database repositories
vi.mock("@/src/db/repositories/agent-run.repository", () => ({
  agentRunRepository: {
    startAgentRun: vi.fn().mockResolvedValue({}),
    completeAgentRun: vi.fn().mockResolvedValue({}),
    failAgentRun: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/src/db/repositories/evidence.repository", () => ({
  evidenceRepository: {
    insertManyEvidence: vi.fn().mockImplementation((evs) => Promise.resolve(evs)),
  },
}));

describe("Specialist Orchestrator Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully run all four specialist agents in parallel and return aggregated evidence", async () => {
    const researchId = "res_abc123";
    const ticker = "AAPL";
    const mockIdentity = {
      symbol: "AAPL",
      companyName: "Apple Inc.",
      exchange: "NASDAQ",
      country: "US",
      market: "NASDAQ",
      currency: "USD",
      cik: "0000320193",
      resolved: true,
    };

    const allEvidence = await orchestrateSpecialists(researchId, ticker, mockIdentity);

    // Verify all clients are invoked
    expect(fmpClient.getCompanyProfile).toHaveBeenCalledWith(ticker);
    expect(secClient.getSubmissions).toHaveBeenCalledWith("0000320193");
    expect(tavilyClient.search).toHaveBeenCalled();
    expect(alphaVantageClient.getEarnings).toHaveBeenCalledWith(ticker);

    // Verify database inserts for agent runs
    expect(agentRunRepository.startAgentRun).toHaveBeenCalledTimes(4);
    expect(agentRunRepository.completeAgentRun).toHaveBeenCalledTimes(4);
    // Verify aggregated evidence count (each of the 4 agents returns 1 mock item)
    expect(allEvidence.length).toBe(4);
    allEvidence.forEach((ev) => {
      expect(ev.researchId).toBe(researchId);
      expect(ev.claim).toBe("Test Claim");
      expect(ev.confidence).toBe("0.9");
      expect(ev.sourceQuality).toBe("0.9");
    });
  });
});
