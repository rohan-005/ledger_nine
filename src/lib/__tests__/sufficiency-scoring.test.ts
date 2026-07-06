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
      { agentId: "financial", status: "completed" } as any,
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

  it("fails sufficiency gate on missing regulatory filings (SEC) for US assets", () => {
    const evidence: EvidenceItem[] = [
      { id: "e1", category: "business", sourceType: "fmp" } as any,
      { id: "e2", category: "financial", sourceType: "fmp" } as any,
      { id: "e3", category: "valuation", sourceType: "fmp" } as any,
      { id: "e4", category: "news", sourceType: "tavily" } as any,
      { id: "e5", category: "risk", sourceType: "tavily" } as any,
    ];
    const agentRuns: AgentRun[] = [
      { agentId: "financial", status: "completed" } as any,
      { agentId: "macro", status: "completed" } as any,
    ];
    const res = checkSufficiency(evidence, agentRuns, true);
    expect(res.sufficient).toBe(false);
    expect(res.outcome).toBe("insufficient_evidence");
    expect(res.reasons).toContain("NO_REGULATORY_EVIDENCE");
  });

  it("fails sufficiency gate on insufficient specialist coverage (fewer than 2 successful agents)", () => {
    const evidence: EvidenceItem[] = [
      { id: "e1", category: "business", sourceType: "fmp" } as any,
      { id: "e2", category: "financial", sourceType: "fmp" } as any,
      { id: "e3", category: "valuation", sourceType: "sec" } as any,
      { id: "e4", category: "news", sourceType: "tavily" } as any,
      { id: "e5", category: "risk", sourceType: "sec" } as any,
    ];
    const agentRuns: AgentRun[] = [
      { agentId: "sec", status: "completed" } as any,
      { agentId: "financial", status: "failed" } as any,
    ];
    const res = checkSufficiency(evidence, agentRuns, true);
    expect(res.sufficient).toBe(false);
    expect(res.outcome).toBe("insufficient_evidence");
    expect(res.reasons).toContain("INSUFFICIENT_SPECIALIST_COVERAGE");
  });

  it("fails sufficiency gate on insufficient source diversity (fewer than 2 unique source types)", () => {
    const evidence: EvidenceItem[] = [
      { id: "e1", category: "business", sourceType: "tavily" } as any,
      { id: "e2", category: "financial", sourceType: "tavily" } as any,
      { id: "e3", category: "valuation", sourceType: "tavily" } as any,
      { id: "e4", category: "news", sourceType: "tavily" } as any,
      { id: "e5", category: "risk", sourceType: "tavily" } as any,
    ];
    const agentRuns: AgentRun[] = [
      { agentId: "macro", status: "completed" } as any,
      { agentId: "earnings", status: "completed" } as any,
    ];
    const res = checkSufficiency(evidence, agentRuns, false);
    expect(res.sufficient).toBe(false);
    expect(res.outcome).toBe("insufficient_evidence");
    expect(res.reasons).toContain("INSUFFICIENT_SOURCE_DIVERSITY");
  });
});

describe("Scoring Engine & Contradiction Filters", () => {
  it("returns null scores when insufficient", () => {
    const res = calculateScores([], [], false);
    expect(res.final).toBeNull();
    expect(res.decision).toBeNull();
  });

  it("filters out immaterial price contradictions (<2% relative difference)", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "The stock is trading at $185", category: "valuation", sourceType: "tavily", rawValue: "185" },
      { id: "e2", claim: "Company shares are $187", category: "valuation", sourceType: "tavily", rawValue: "187" },
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2" }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(0);
  });

  it("applies penalty for material price contradictions (>=2% relative difference)", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "The stock is trading at $100", category: "valuation", sourceType: "tavily", rawValue: "100" },
      { id: "e2", claim: "Company shares are $200", category: "valuation", sourceType: "tavily", rawValue: "200" },
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2" }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBeGreaterThan(0);
  });

  it("filters out temporal mismatch contradictions (short term vs long term)", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "The stock rose 3% today", category: "news", sourceType: "tavily", rawValue: "" },
      { id: "e2", claim: "The company has strong long-term trend and outlook", category: "news", sourceType: "tavily", rawValue: "" },
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2" }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(0);
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
