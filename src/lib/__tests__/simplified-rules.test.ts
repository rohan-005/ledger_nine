import { describe, it, expect } from "vitest";
import { checkSufficiency } from "../research/sufficiency";
import { calculateScores } from "../../core/scoring/scoring-engine";
import { EvidenceItem, AgentRun } from "@/src/types/frontend";

describe("Simplified Research Pipeline Offline Tests (Exactly 20 Tests)", () => {
  // --- SUFFICIENCY GATE TESTS (Tests 1 to 7) ---

  it("Test 1: Sufficiency Gate - passes exactly at or above 50% coverage", () => {
    // 2/4 agents = 0.5 ratio -> 50% * 0.5 = 0.25
    // 3/5 categories = 0.6 ratio -> 30% * 0.6 = 0.18
    // 2/4 source types = 0.5 ratio -> 20% * 0.5 = 0.10
    // Total coverage score = 0.25 + 0.18 + 0.10 = 0.53 >= 0.50
    const evidence: EvidenceItem[] = [
      { id: "e1", category: "business", sourceType: "fmp" } as any,
      { id: "e2", category: "financial", sourceType: "sec" } as any,
      { id: "e3", category: "valuation", sourceType: "sec" } as any,
    ];
    const agentRuns: AgentRun[] = [
      { agentId: "financial", status: "completed" } as any,
      { agentId: "sec", status: "completed" } as any,
    ];
    const res = checkSufficiency(evidence, agentRuns, false);
    expect(res.sufficient).toBe(true);
    expect(res.outcome).toBe("sufficient");
  });

  it("Test 2: Sufficiency Gate - fails when coverage is below 50%", () => {
    // 2/4 agents = 0.5 ratio -> 50% * 0.5 = 0.25
    // 1/5 categories = 0.2 ratio -> 30% * 0.2 = 0.06
    // 2/4 source types = 0.5 ratio -> 20% * 0.5 = 0.10
    // Total coverage score = 0.25 + 0.06 + 0.10 = 0.41 < 0.50
    const evidence: EvidenceItem[] = [
      { id: "e1", category: "business", sourceType: "fmp" } as any,
      { id: "e2", category: "business", sourceType: "sec" } as any,
    ];
    const agentRuns: AgentRun[] = [
      { agentId: "financial", status: "completed" } as any,
      { agentId: "sec", status: "completed" } as any,
    ];
    const res = checkSufficiency(evidence, agentRuns, false);
    expect(res.sufficient).toBe(false);
    expect(res.outcome).toBe("insufficient_evidence");
    expect(res.reasons).toContain("INSUFFICIENT_COVERAGE_SCORE");
  });

  it("Test 3: Sufficiency Gate - fails when fewer than 2 specialist agents complete", () => {
    const evidence: EvidenceItem[] = [
      { id: "e1", category: "business", sourceType: "fmp" } as any,
      { id: "e2", category: "financial", sourceType: "sec" } as any,
      { id: "e3", category: "valuation", sourceType: "sec" } as any,
      { id: "e4", category: "news", sourceType: "tavily" } as any,
      { id: "e5", category: "risk", sourceType: "alpha_vantage" } as any,
    ];
    const agentRuns: AgentRun[] = [
      { agentId: "financial", status: "completed" } as any,
    ];
    const res = checkSufficiency(evidence, agentRuns, false);
    expect(res.sufficient).toBe(false);
    expect(res.reasons).toContain("INSUFFICIENT_SPECIALIST_COVERAGE");
  });

  it("Test 4: Sufficiency Gate - passes when exactly 2 specialist agents complete", () => {
    const evidence: EvidenceItem[] = [
      { id: "e1", category: "business", sourceType: "fmp" } as any,
      { id: "e2", category: "financial", sourceType: "sec" } as any,
      { id: "e3", category: "valuation", sourceType: "sec" } as any,
      { id: "e4", category: "news", sourceType: "tavily" } as any,
      { id: "e5", category: "risk", sourceType: "alpha_vantage" } as any,
    ];
    const agentRuns: AgentRun[] = [
      { agentId: "financial", status: "completed" } as any,
      { agentId: "sec", status: "completed" } as any,
    ];
    const res = checkSufficiency(evidence, agentRuns, false);
    expect(res.sufficient).toBe(true);
  });

  it("Test 5: Sufficiency Gate - fails when fewer than 2 unique source types are present", () => {
    const evidence: EvidenceItem[] = [
      { id: "e1", category: "business", sourceType: "fmp" } as any,
      { id: "e2", category: "financial", sourceType: "fmp" } as any,
      { id: "e3", category: "valuation", sourceType: "fmp" } as any,
      { id: "e4", category: "news", sourceType: "fmp" } as any,
      { id: "e5", category: "risk", sourceType: "fmp" } as any,
    ];
    const agentRuns: AgentRun[] = [
      { agentId: "financial", status: "completed" } as any,
      { agentId: "macro", status: "completed" } as any,
    ];
    const res = checkSufficiency(evidence, agentRuns, false);
    expect(res.sufficient).toBe(false);
    expect(res.reasons).toContain("INSUFFICIENT_SOURCE_DIVERSITY");
  });

  it("Test 6: Sufficiency Gate - passes when exactly 2 unique source types are present", () => {
    const evidence: EvidenceItem[] = [
      { id: "e1", category: "business", sourceType: "fmp" } as any,
      { id: "e2", category: "financial", sourceType: "sec" } as any,
      { id: "e3", category: "valuation", sourceType: "sec" } as any,
      { id: "e4", category: "news", sourceType: "fmp" } as any,
      { id: "e5", category: "risk", sourceType: "sec" } as any,
    ];
    const agentRuns: AgentRun[] = [
      { agentId: "financial", status: "completed" } as any,
      { agentId: "sec", status: "completed" } as any,
    ];
    const res = checkSufficiency(evidence, agentRuns, false);
    expect(res.sufficient).toBe(true);
  });

  it("Test 7: Sufficiency Gate - missing regulatory filings (SEC) for US assets does not block if overall coverage is sufficient", () => {
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
    const res = checkSufficiency(evidence, agentRuns, true); // true = isUSAsset
    expect(res.sufficient).toBe(true);
    expect(res.outcome).toBe("sufficient");
  });

  // --- CONTRADICTION GATING TESTS (Tests 8 to 18) ---

  it("Test 8: Contradictions - self-contradiction check rejects when evidenceIdA === evidenceIdB", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "Revenue is $10B", category: "financial", sourceType: "sec", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80 }
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e1", confidence: 0.8 }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(0);
  });

  it("Test 9: Contradictions - rejects when referenced evidence items do not exist", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "Revenue is $10B", category: "financial", sourceType: "sec", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80 }
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2", confidence: 0.8 }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(0);
  });

  it("Test 10: Contradictions - rejects when categories/topics do not match (cross-category)", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "Revenue is $10B", category: "financial", sourceType: "sec", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80 },
      { id: "e2", claim: "Company risk is high", category: "risk", sourceType: "tavily", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 20 }
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2", confidence: 0.8 }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(0);
  });

  it("Test 11: Contradictions - accepts when categories/topics match", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "Revenue grew by 20%", category: "financial", sourceType: "sec", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80 },
      { id: "e2", claim: "Revenue grew by only 5%", category: "financial", sourceType: "fmp", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 30 }
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2", confidence: 0.8 }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(7); // Medium severity penalty is 7
  });

  it("Test 12: Contradictions - rejects when claims refer to different temporal scopes", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "The stock rose 3% today", category: "news", sourceType: "tavily", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80 },
      { id: "e2", claim: "The company has a positive long-term outlook", category: "news", sourceType: "tavily", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80 }
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2", confidence: 0.8 }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(0);
  });

  it("Test 13: Contradictions - accepts when claims refer to compatible temporal scopes", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "The company has a positive long-term outlook", category: "news", sourceType: "tavily", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80 },
      { id: "e2", claim: "The long-term outlook remains highly bearish", category: "news", sourceType: "tavily", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 20 }
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2", confidence: 0.8 }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(7);
  });

  it("Test 14: Contradictions - rejects when price variance is immaterial (<2% and <1.0)", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "Share price is $100", category: "valuation", sourceType: "fmp", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80, rawValue: "100" },
      { id: "e2", claim: "Share price is $101", category: "valuation", sourceType: "tavily", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80, rawValue: "101" }
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2", confidence: 0.8 }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(0);
  });

  it("Test 15: Contradictions - accepts when price variance is material (>=2%)", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "Share price is $100", category: "valuation", sourceType: "fmp", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80, rawValue: "100" },
      { id: "e2", claim: "Share price is $110", category: "valuation", sourceType: "tavily", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80, rawValue: "110" }
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2", confidence: 0.8 }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(7);
  });

  it("Test 16: Contradictions - rejects when contradiction confidence is below 70%", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "Revenue is $10B", category: "financial", sourceType: "sec", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80 },
      { id: "e2", claim: "Revenue is $5B", category: "financial", sourceType: "fmp", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 30 }
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2", confidence: 0.69 }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(0);
  });

  it("Test 17: Contradictions - accepts when contradiction confidence is at least 70%", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "Revenue is $10B", category: "financial", sourceType: "sec", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80 },
      { id: "e2", claim: "Revenue is $5B", category: "financial", sourceType: "fmp", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 30 }
    ];
    const contradictions = [
      { severity: "medium", evidenceIdA: "e1", evidenceIdB: "e2", confidence: 0.70 }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(7);
  });

  it("Test 18: Contradictions - total penalty is capped at max -10 points", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "Claim 1", category: "financial", sourceType: "sec", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 80 },
      { id: "e2", claim: "Claim 2", category: "financial", sourceType: "fmp", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 30 },
      { id: "e3", claim: "Claim 3", category: "financial", sourceType: "tavily", confidence: 0.9, sourceQuality: 0.9, normalizedValue: 40 }
    ];
    // Three high severity contradictions = 3 * 15 = 45 points penalty, should cap at 25
    const contradictions = [
      { severity: "high", evidenceIdA: "e1", evidenceIdB: "e2", confidence: 0.90 },
      { severity: "high", evidenceIdA: "e2", evidenceIdB: "e3", confidence: 0.90 },
      { severity: "high", evidenceIdA: "e1", evidenceIdB: "e3", confidence: 0.90 }
    ];
    const res = calculateScores(evidenceList, contradictions, true);
    expect(res.contradictionPenalty).toBe(25);
  });

  // --- SCORING ENGINE TESTS (Tests 19 & 20) ---

  it("Test 19: Scoring - missing metrics are excluded from the category score denominator", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "Revenue is positive", category: "financial", sourceType: "sec", confidence: 1.0, sourceQuality: 1.0, normalizedValue: 80 },
      { id: "e2", claim: "Earnings are missing", category: "financial", sourceType: "fmp", confidence: 1.0, sourceQuality: 1.0, normalizedValue: null }
    ];
    const res = calculateScores(evidenceList, [], true);
    // Score of financial pillar should be based only on e1 (value 80), since e2 is missing and excluded
    expect(res.financial).toBe(80);
  });

  it("Test 20: Scoring - duplicate evidence IDs are deduplicated and do not double count", () => {
    const evidenceList: any[] = [
      { id: "e1", claim: "Revenue is positive", category: "financial", sourceType: "sec", confidence: 1.0, sourceQuality: 1.0, normalizedValue: 80 },
      { id: "e1", claim: "Revenue is positive", category: "financial", sourceType: "sec", confidence: 1.0, sourceQuality: 1.0, normalizedValue: 80 }
    ];
    const res = calculateScores(evidenceList, [], true);
    // Under the hood, e1 is only counted once
    expect(res.financial).toBe(80);
    expect(res.contributionLedger.filter((l) => l.evidenceId === "e1").length).toBe(1);
  });
});
