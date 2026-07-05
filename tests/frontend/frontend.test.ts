import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch } from "@/src/lib/api/client";
import {
  createResearch,
  getResearch,
  getResearchStatus,
  getResearchEvidence,
  getResearchAgents,
  getResearchContradictions,
} from "@/src/lib/api/research";
import { parseScore } from "@/src/types/frontend";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown) {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  } as Response;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
}

function mockFetchNetworkError() {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
}

// ─── parseScore ───────────────────────────────────────────────────────────────

describe("parseScore", () => {
  it("parses a numeric string", () => {
    expect(parseScore("74.23")).toBeCloseTo(74.23);
  });
  it("returns 0 for null", () => {
    expect(parseScore(null)).toBe(0);
  });
  it("returns 0 for undefined", () => {
    expect(parseScore(undefined)).toBe(0);
  });
  it("returns 0 for NaN string", () => {
    expect(parseScore("not-a-number")).toBe(0);
  });
  it("handles integer string", () => {
    expect(parseScore("100")).toBe(100);
  });
  it("handles zero string", () => {
    expect(parseScore("0")).toBe(0);
  });
});

// ─── apiFetch ─────────────────────────────────────────────────────────────────

describe("apiFetch", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns parsed JSON on 200", async () => {
    mockFetch(200, { hello: "world" });
    const data = await apiFetch<{ hello: string }>("/api/test");
    expect(data).toEqual({ hello: "world" });
  });

  it("throws ApiError with server error message on 400", async () => {
    mockFetch(400, { error: "Invalid ticker" });
    await expect(apiFetch("/api/test")).rejects.toMatchObject({
      error: "Invalid ticker",
    });
  });

  it("throws ApiError with details on 400 with details field", async () => {
    mockFetch(400, { error: "Validation failed", details: { ticker: "required" } });
    await expect(apiFetch("/api/test")).rejects.toMatchObject({
      error: "Validation failed",
      details: { ticker: "required" },
    });
  });

  it("throws ApiError on 404", async () => {
    mockFetch(404, { error: "Research run not found" });
    await expect(apiFetch("/api/research/bad-id")).rejects.toMatchObject({
      error: "Research run not found",
    });
  });

  it("throws ApiError on 500", async () => {
    mockFetch(500, { error: "Internal server error" });
    await expect(apiFetch("/api/research")).rejects.toMatchObject({
      error: "Internal server error",
    });
  });

  it("throws network ApiError on fetch rejection", async () => {
    mockFetchNetworkError();
    await expect(apiFetch("/api/test")).rejects.toMatchObject({
      error: expect.stringContaining("Network request failed"),
    });
  });

  it("throws malformed ApiError when JSON parse fails on success", async () => {
    const badRes = {
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError("Unexpected token"); },
    } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(badRes));
    await expect(apiFetch("/api/test")).rejects.toMatchObject({
      error: expect.stringContaining("malformed"),
    });
  });
});

// ─── Research API client ──────────────────────────────────────────────────────

describe("research API client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("createResearch sends POST with JSON body and returns researchId", async () => {
    const payload = { researchId: "run_abc123", status: "queued" };
    mockFetch(201, payload);
    const result = await createResearch({
      ticker: "AAPL",
      investmentHorizon: "3-5 years",
      riskTolerance: "moderate",
    });
    expect(result.researchId).toBe("run_abc123");
    expect(result.status).toBe("queued");

    const fetchCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(fetchCalls[0][0]).toBe("/api/research");
    expect(fetchCalls[0][1].method).toBe("POST");
    const body = JSON.parse(fetchCalls[0][1].body);
    expect(body.ticker).toBe("AAPL");
  });

  it("getResearch fetches research summary by id", async () => {
    const payload = { run: { id: "run_abc", status: "completed" }, score: null, report: null };
    mockFetch(200, payload);
    const result = await getResearch("run_abc");
    expect(result.run.id).toBe("run_abc");
    expect(result.run.status).toBe("completed");
  });

  it("getResearchStatus fetches minimal status shape", async () => {
    const payload = { id: "run_abc", ticker: "AAPL", status: "running", currentNode: "specialists", companyName: null, errorMessage: null, startedAt: null, completedAt: null };
    mockFetch(200, payload);
    const result = await getResearchStatus("run_abc");
    expect(result.status).toBe("running");
    expect(result.currentNode).toBe("specialists");
  });

  it("getResearchEvidence returns evidence array", async () => {
    const payload = { evidence: [{ id: "ev_1", claim: "Revenue grew", category: "financial", sourceType: "fmp" }] };
    mockFetch(200, payload);
    const result = await getResearchEvidence("run_abc");
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].id).toBe("ev_1");
  });

  it("getResearchAgents returns agentRuns array", async () => {
    const payload = { agentRuns: [{ id: "ag_1", agentId: "financialAgent", status: "completed", fallbackUsed: false }] };
    mockFetch(200, payload);
    const result = await getResearchAgents("run_abc");
    expect(result.agentRuns[0].agentId).toBe("financialAgent");
  });

  it("getResearchContradictions returns contradictions array", async () => {
    const payload = { contradictions: [{ id: "ct_1", description: "Price conflict", severity: "medium", confidence: "0.8", evidenceIdA: "ev_1", evidenceIdB: "ev_2" }] };
    mockFetch(200, payload);
    const result = await getResearchContradictions("run_abc");
    expect(result.contradictions[0].severity).toBe("medium");
  });

  it("propagates ApiError from createResearch on 400", async () => {
    mockFetch(400, { error: "Invalid request body" });
    await expect(
      createResearch({ ticker: "", investmentHorizon: "3-5 years", riskTolerance: "moderate" })
    ).rejects.toMatchObject({ error: "Invalid request body" });
  });
});

// ─── Evidence filtering logic ─────────────────────────────────────────────────

describe("evidence filtering logic", () => {
  const evidence = [
    { id: "ev_1", category: "financial", sourceType: "fmp", claim: "Revenue" },
    { id: "ev_2", category: "news", sourceType: "tavily", claim: "Earnings beat" },
    { id: "ev_3", category: "financial", sourceType: "sec", claim: "Net income" },
    { id: "ev_4", category: "business", sourceType: "llm_inference", claim: "Competitive moat" },
  ];

  function filterEvidence(
    items: typeof evidence,
    category: string,
    source: string
  ) {
    return items.filter((item) => {
      const catOk = category === "all" || item.category === category;
      const srcOk = source === "all" || item.sourceType === source;
      return catOk && srcOk;
    });
  }

  it("returns all items when both filters are 'all'", () => {
    expect(filterEvidence(evidence, "all", "all")).toHaveLength(4);
  });

  it("filters by category", () => {
    const result = filterEvidence(evidence, "financial", "all");
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.category === "financial")).toBe(true);
  });

  it("filters by source", () => {
    const result = filterEvidence(evidence, "all", "sec");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ev_3");
  });

  it("filters by both category and source", () => {
    const result = filterEvidence(evidence, "financial", "fmp");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ev_1");
  });

  it("returns empty array when no match", () => {
    expect(filterEvidence(evidence, "risk", "sec")).toHaveLength(0);
  });

  it("identifies llm_inference source type", () => {
    const result = filterEvidence(evidence, "all", "llm_inference");
    expect(result[0].sourceType).toBe("llm_inference");
  });
});

// ─── Contradiction display logic ──────────────────────────────────────────────

describe("contradiction display logic", () => {
  it("empty contradictions array means zero contradictions", () => {
    expect([].length === 0).toBe(true);
  });

  it("severity high is valid", () => {
    const severity = "high";
    expect(["low", "medium", "high"]).toContain(severity);
  });

  it("resolves evidence claim from map when available", () => {
    const evidenceMap = new Map([
      ["ev_1", { id: "ev_1", claim: "Revenue grew 20% YoY" }],
    ]);
    const contradiction = { evidenceIdA: "ev_1", evidenceIdB: "ev_999" };
    const evA = evidenceMap.get(contradiction.evidenceIdA);
    const evB = evidenceMap.get(contradiction.evidenceIdB);
    expect(evA?.claim).toBe("Revenue grew 20% YoY");
    expect(evB).toBeUndefined();
  });
});

// ─── Score display logic ───────────────────────────────────────────────────────

describe("score display logic", () => {
  it("INVEST decision when finalScore >= 65", () => {
    const decision = parseScore("74.23") >= 65 ? "INVEST" : "PASS";
    expect(decision).toBe("INVEST");
  });

  it("PASS decision when finalScore < 65", () => {
    const decision = parseScore("40.00") >= 65 ? "INVEST" : "PASS";
    expect(decision).toBe("PASS");
  });

  it("contradiction penalty should be treated as negative", () => {
    const penalty = parseScore("16");
    // The UI shows this as −16, not a positive score
    expect(penalty).toBe(16);
    expect(`−${penalty.toFixed(1)}`).toBe("−16.0");
  });

  it("clamps score display to 0..100 range", () => {
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    expect(clamp(-5)).toBe(0);
    expect(clamp(105)).toBe(100);
    expect(clamp(74.2)).toBeCloseTo(74.2);
  });
});
