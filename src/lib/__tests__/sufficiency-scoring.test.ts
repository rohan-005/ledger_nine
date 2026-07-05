import { describe, it, expect } from "vitest";
import { checkSufficiency } from "../research/sufficiency";
import { calculateScores } from "../../core/scoring/scoring-engine";
import { parseAssetProfile } from "../research/asset-identity";
import { sanitizeErrorMessage } from "../errors-sanitizer";
import { EvidenceItem, AgentRun } from "@/src/types/frontend";

describe("Asset Identity Parser", () => {
  it("resolves a valid US asset profile", () => {
    const profile = { symbol: "AAPL", companyName: "Apple Inc.", country: "US", exchangeShortName: "NASDAQ" };
    const res = parseAssetProfile("AAPL", profile);
    expect(res.resolved).toBe(true);
    expect(res.companyName).toBe("Apple Inc.");
    expect(res.country).toBe("US");
  });

  it("fails to resolve null/missing profile", () => {
    const res = parseAssetProfile("INVALID", null);
    expect(res.resolved).toBe(false);
  });
});

describe("Sufficiency Gate", () => {
  it("identifies sufficient research runs", () => {
    const evidence: EvidenceItem[] = [
      { id: "e1", category: "business", sourceType: "fmp" } as any,
      { id: "e2", category: "financial", sourceType: "fmp" } as any,
      { id: "e3", category: "valuation", sourceType: "sec" } as any,
      { id: "e4", category: "news", sourceType: "tavily" } as any,
      { id: "e5", category: "risk", sourceType: "sec" } as any,
    ];
    const agentRuns: AgentRun[] = [
      { agentId: "sec", status: "completed" } as any,
    ];
    const res = checkSufficiency(evidence, agentRuns, true);
    expect(res.sufficient).toBe(true);
    expect(res.outcome).toBe("sufficient");
  });

  it("fails sufficiency gate on insufficient category coverage", () => {
    const evidence: EvidenceItem[] = [
      { id: "e1", category: "business", sourceType: "fmp" } as any,
    ];
    const agentRuns: AgentRun[] = [];
    const res = checkSufficiency(evidence, agentRuns, true);
    expect(res.sufficient).toBe(false);
    expect(res.outcome).toBe("insufficient_evidence");
    expect(res.reasons).toContain("INSUFFICIENT_CATEGORY_COVERAGE");
  });
});

describe("Scoring Engine", () => {
  it("returns null scores when insufficient", () => {
    const res = calculateScores([], [], false);
    expect(res.final).toBeNull();
    expect(res.decision).toBeNull();
  });
});

describe("Error Sanitizer", () => {
  it("scrubs billing link and returns user-friendly limit error", () => {
    const raw = "Error: billing is blocked. Check https://billing.google.com/details?org-12345";
    const res = sanitizeErrorMessage(raw);
    expect(res).toBe("Service temporarily unavailable due to capacity or API provider limits. Please try again later.");
  });

  it("scrubs project IDs and credentials", () => {
    const raw = "Auth failure with api-key=abc123xyz999 for project-id: proj-99999";
    const res = sanitizeErrorMessage(raw);
    expect(res).not.toContain("abc123xyz999");
    expect(res).not.toContain("proj-99999");
    expect(res).toContain("api-key=***");
  });
});
