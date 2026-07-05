import { describe, it, expect, vi, beforeEach } from "vitest";
import { LLMRouter } from "../../src/core/llm/llm-router";
import { LLMProvider, LLMResponse } from "../../src/core/llm/llm.types";
import { Evidence } from "../../src/core/evidence/evidence.types";
import { agentRunRepository } from "../../src/db/repositories/agent-run.repository";

// Mock the agent run repository database call
vi.mock("../../src/db/repositories/agent-run.repository", () => ({
  agentRunRepository: {
    recordFallback: vi.fn().mockResolvedValue({}),
  },
}));

class FakeLLMProvider implements LLMProvider {
  public callCount = 0;
  private readonly responseText: string;
  private readonly shouldFailCount: number;

  constructor(responseText: string, shouldFailCount = 0) {
    this.responseText = responseText;
    this.shouldFailCount = shouldFailCount;
  }

  async generateText(_prompt: string): Promise<LLMResponse> {
    this.callCount++;
    if (this.callCount <= this.shouldFailCount) {
      throw new Error(`Simulated LLM Error ${this.callCount}`);
    }
    return {
      text: this.responseText,
      latencyMs: 10,
      model: "fake-model",
      provider: "fake-provider",
    };
  }
}

describe("LLM Router Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed on first primary attempt if no errors occur", async () => {
    const primary = new FakeLLMProvider("Gemini Success", 0);
    const fallback = new FakeLLMProvider("Groq Success", 0);
    const router = new LLMRouter(primary, fallback);

    const res = await router.generateText("Hello World");
    expect(res.text).toBe("Gemini Success");
    expect(primary.callCount).toBe(1);
    expect(fallback.callCount).toBe(0);
  });

  it("should retry primary once and succeed on second attempt if first fails", async () => {
    const primary = new FakeLLMProvider("Gemini Success", 1);
    const fallback = new FakeLLMProvider("Groq Success", 0);
    const router = new LLMRouter(primary, fallback);

    const res = await router.generateText("Hello World");
    expect(res.text).toBe("Gemini Success");
    expect(primary.callCount).toBe(2);
    expect(fallback.callCount).toBe(0);
  });

  it("should fall back to Groq if primary fails 2 times", async () => {
    const primary = new FakeLLMProvider("Gemini Success", 2);
    const fallback = new FakeLLMProvider("Groq Success", 0);
    const router = new LLMRouter(primary, fallback);

    const res = await router.generateText("Hello World", { agentRunId: "agent_123" });
    expect(res.text).toBe("Groq Success");
    expect(primary.callCount).toBe(2);
    expect(fallback.callCount).toBe(1);
    expect(agentRunRepository.recordFallback).toHaveBeenCalledWith("agent_123", expect.any(String));
  });

  it("should compress evidence before Groq fallback if a prompt builder is provided", async () => {
    const primary = new FakeLLMProvider("Gemini Success", 2);
    const fallback = new FakeLLMProvider("Groq Success", 0);
    const router = new LLMRouter(primary, fallback);

    const dummyEvidences: Evidence[] = [
      {
        id: "ev_1",
        researchId: "run_1",
        claim: "Claim A",
        category: "financial",
        sourceType: "sec",
        confidence: 0.9,
        sourceQuality: 0.9,
        agentId: "agent_1",
        createdAt: "now",
      },
    ];

    const builderSpy = vi.fn().mockImplementation((evs: Evidence[]) => {
      return `Prompt with ${evs.length} evidence items.`;
    });

    const res = await router.generateText(builderSpy, {
      agentRunId: "agent_123",
      evidence: dummyEvidences,
      category: "financial",
    });

    expect(res.text).toBe("Groq Success");
    expect(builderSpy).toHaveBeenCalledTimes(2); // Initial builder call, then rebuild on fallback
    expect(agentRunRepository.recordFallback).toHaveBeenCalled();
  });
});
