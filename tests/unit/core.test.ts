import { describe, it, expect } from "vitest";
import { Evidence } from "../../src/core/evidence/evidence.types";
import { EvidencePool } from "../../src/core/evidence/evidence-pool";
import { calculateScores } from "../../src/core/scoring/scoring-engine";
import { compressContext } from "../../src/core/llm/context-compressor";

describe("Evidence Pool Tests", () => {
  const dummyEvidence1: Evidence = {
    id: "ev_1",
    researchId: "run_1",
    claim: "Claim A",
    category: "financial",
    sourceType: "sec",
    confidence: 0.9,
    sourceQuality: 1.0,
    agentId: "financial_agent",
    createdAt: new Date().toISOString(),
  };

  const dummyEvidence2: Evidence = {
    id: "ev_2",
    researchId: "run_1",
    claim: "claim a!", // Duplicate claim under normalize check
    category: "financial",
    sourceType: "sec",
    confidence: 0.8,
    sourceQuality: 0.9,
    agentId: "financial_agent",
    createdAt: new Date().toISOString(),
  };

  const dummyEvidence3: Evidence = {
    id: "ev_3",
    researchId: "run_1",
    claim: "Claim B",
    category: "business",
    sourceType: "tavily",
    confidence: 1.5, // Check clamping
    sourceQuality: -0.2, // Check clamping
    agentId: "business_agent",
    createdAt: new Date().toISOString(),
  };

  it("should support append and maintain immutable behavior", () => {
    const pool = new EvidencePool();
    const newPool = pool.append(dummyEvidence1);
    expect(pool.list().length).toBe(0);
    expect(newPool.list().length).toBe(1);
    expect(newPool.list()[0].id).toBe("ev_1");
  });

  it("should clamp confidence and quality between 0 and 1", () => {
    const pool = new EvidencePool().append(dummyEvidence3);
    const item = pool.list()[0];
    expect(item.confidence).toBe(1);
    expect(item.sourceQuality).toBe(0);
  });

  it("should deduplicate case-insensitive claims conservatively", () => {
    const pool = new EvidencePool().appendMany([dummyEvidence1, dummyEvidence2]);
    const deduped = pool.deduplicate();
    expect(deduped.list().length).toBe(1);
    expect(deduped.list()[0].id).toBe("ev_1");
  });

  it("should filter by category and source type", () => {
    const pool = new EvidencePool().appendMany([dummyEvidence1, dummyEvidence3]);
    expect(pool.byCategory("financial").length).toBe(1);
    expect(pool.byCategory("business").length).toBe(1);
    expect(pool.bySourceType("sec").length).toBe(1);
  });
});

describe("Scoring Engine Tests", () => {
  const baseSecFinancial: Evidence = {
    id: "ev_f1",
    researchId: "run_1",
    claim: "Revenue grew 20%",
    category: "financial",
    sourceType: "sec",
    normalizedValue: 80, // high score
    confidence: 1.0,
    sourceQuality: 1.0,
    agentId: "financial_agent",
    createdAt: new Date().toISOString(),
  };

  const baseSecBusiness: Evidence = {
    id: "ev_b1",
    researchId: "run_1",
    claim: "Strong market moat",
    category: "business",
    sourceType: "sec",
    normalizedValue: 90,
    confidence: 1.0,
    sourceQuality: 1.0,
    agentId: "business_agent",
    createdAt: new Date().toISOString(),
  };

  const baseSecValuation: Evidence = {
    id: "ev_v1",
    researchId: "run_1",
    claim: "Valuation looks fair",
    category: "valuation",
    sourceType: "sec",
    normalizedValue: 70,
    confidence: 1.0,
    sourceQuality: 1.0,
    agentId: "valuation_agent",
    createdAt: new Date().toISOString(),
  };

  const baseTavilyNews: Evidence = {
    id: "ev_n1",
    researchId: "run_1",
    claim: "Positive recent earnings press",
    category: "news",
    sourceType: "tavily",
    normalizedValue: 85,
    confidence: 0.9,
    sourceQuality: 0.8,
    agentId: "news_agent",
    createdAt: new Date().toISOString(),
  };

  const baseRisk: Evidence = {
    id: "ev_r1",
    researchId: "run_1",
    claim: "Risks are low and well-mitigated",
    category: "risk",
    sourceType: "sec",
    normalizedValue: 80, // High score = low risk
    confidence: 1.0,
    sourceQuality: 1.0,
    agentId: "risk_agent",
    createdAt: new Date().toISOString(),
  };

  const fullEvidence = [baseSecFinancial, baseSecBusiness, baseSecValuation, baseTavilyNews, baseRisk];

  it("should recommend INVEST on high quality bullish evidence", () => {
    const scores = calculateScores(fullEvidence, []);
    expect(scores.decision).toBe("INVEST");
    expect(scores.final).toBeGreaterThanOrEqual(65);
  });

  it("should recommend PASS on weak evidence", () => {
    const weakFinancial = { ...baseSecFinancial, normalizedValue: 30 };
    const weakBusiness = { ...baseSecBusiness, normalizedValue: 40 };
    const list = [weakFinancial, weakBusiness, baseSecValuation, baseTavilyNews, baseRisk];
    const scores = calculateScores(list, []);
    expect(scores.decision).toBe("PASS");
    expect(scores.final).toBeLessThan(65);
  });

  it("should apply contradiction penalty", () => {
    const list = [
      ...fullEvidence,
      {
        id: "ev_f2",
        researchId: "run_1",
        claim: "Revenue fell by 10%",
        category: "financial",
        sourceType: "sec",
        normalizedValue: 20,
        confidence: 1.0,
        sourceQuality: 1.0,
        agentId: "financial_agent",
        createdAt: new Date().toISOString(),
      }
    ];
    const scoresNoPenalty = calculateScores(list, []);
    const scoresWithPenalty = calculateScores(list, [{ severity: "high", evidenceIdA: "ev_f1", evidenceIdB: "ev_f2" }]);
    expect(scoresNoPenalty.final).not.toBeNull();
    expect(scoresWithPenalty.final).toBe(scoresNoPenalty.final! - 15);
  });

  it("should trigger PASS if evidence quality is critically low", () => {
    const lowQualitySec: Evidence = {
      ...baseSecFinancial,
      confidence: 0.1,
      sourceQuality: 0.1, // weight = 0.01, evidence quality will fall below 40
    };
    const scores = calculateScores([lowQualitySec], []);
    expect(scores.evidenceQuality).toBeLessThan(40);
    expect(scores.decision).toBe("PASS");
  });

  it("should apply missing financial primary data penalty", () => {
    const lowNews = { ...baseTavilyNews, normalizedValue: 70 };
    const scores = calculateScores([lowNews], []);
    // Guardrail penalty of -10 applied: base 71 - 10 = 61
    expect(scores.final).toBe(61);
    expect(scores.decision).toBe("PASS");
  });

  it("should always produce a contribution ledger", () => {
    const scores = calculateScores(fullEvidence, []);
    expect(scores.contributionLedger).toBeDefined();
    expect(scores.contributionLedger.length).toBe(fullEvidence.length);
  });

  // ─── Company-Identity Invariance ─────────────────────────────────────────
  // INVARIANT: The score depends only on normalized evidence content,
  // not on the ticker or company name the evidence is associated with.

  it("INV-1: same normalised evidence with different researchId produces same score", () => {
    // researchId is the closest proxy to run identity — swapping it should not change score
    const evidenceA = fullEvidence.map((e) => ({ ...e, researchId: "run_company_A" }));
    const evidenceB = fullEvidence.map((e) => ({ ...e, researchId: "run_company_B" }));
    const scoresA = calculateScores(evidenceA, []);
    const scoresB = calculateScores(evidenceB, []);
    expect(scoresA.final).toBe(scoresB.final);
    expect(scoresA.decision).toBe(scoresB.decision);
  });

  it("INV-2: reordering evidence does not change score", () => {
    const ordered = [...fullEvidence];
    const reversed = [...fullEvidence].reverse();
    const mixed = [fullEvidence[2], fullEvidence[0], fullEvidence[4], fullEvidence[1], fullEvidence[3]];
    const s1 = calculateScores(ordered, []);
    const s2 = calculateScores(reversed, []);
    const s3 = calculateScores(mixed, []);
    expect(s1.final).toBe(s2.final);
    expect(s1.final).toBe(s3.final);
  });

  it("INV-3: duplicating a valid evidence item does not inflate pillar score beyond single-item value", () => {
    // Duplicate the financial item 5 times — weighted average of identical values must equal the value
    const duplicated: Evidence[] = Array.from({ length: 5 }, (_, i) => ({
      ...baseSecFinancial,
      id: `dup_${i}`,
    }));
    const single = [baseSecFinancial];
    const sDuplicated = calculateScores(duplicated, []);
    const sSingle = calculateScores(single, []);
    // Financial pillar score must be the same regardless of duplication
    expect(sDuplicated.financial).toBe(sSingle.financial);
  });

  it("INV-4: evidence item with absent normalizedValue is excluded from weighted average", () => {
    const withMissing: Evidence = {
      ...baseSecFinancial,
      id: "ev_missing",
      normalizedValue: undefined,
    };
    const scores = calculateScores([withMissing], []);
    // No valid normalizedValue → financial pillar score is null (not 50)
    expect(scores.financial).toBeNull();
    // Ledger records this item as excluded_absent
    const ledgerEntry = scores.contributionLedger.find((r) => r.evidenceId === "ev_missing");
    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry!.validityState).toBe("excluded_absent");
    expect(ledgerEntry!.effectiveValue).toBeNull();
    expect(ledgerEntry!.finalContribution).toBe(0);
  });

  it("INV-5: out-of-range normalizedValue (raw financial metric) is excluded, not mapped to neutral", () => {
    // A PE ratio of 28 or revenue of 94_500 must not silently become a 50 or 100
    const rawMetricEvidence: Evidence = {
      ...baseSecFinancial,
      id: "ev_pe",
      normalizedValue: 28, // Looks like a PE ratio — within |28| < 1000, but let's use a truly raw one
    };
    // Use an absurd absolute value to ensure excluded_range
    const outOfRangeEvidence: Evidence = {
      ...baseSecFinancial,
      id: "ev_oor",
      normalizedValue: 94500000, // Revenue in millions — clearly a raw metric
    };
    const scores = calculateScores([outOfRangeEvidence], []);
    const ledgerEntry = scores.contributionLedger.find((r) => r.evidenceId === "ev_oor");
    expect(ledgerEntry!.validityState).toBe("excluded_range");
    expect(ledgerEntry!.effectiveValue).toBeNull();
    // Financial pillar score must be null, not 50
    expect(scores.financial).toBeNull();
  });

  it("INV-6: cross-category contradiction pair receives no penalty", () => {
    // Financial + risk claim — different categories → not comparable → no penalty
    const financial: Evidence = { ...baseSecFinancial, id: "xcat_f" };
    const risk: Evidence = { ...baseRisk, id: "xcat_r" };
    const contradictions = [{ severity: "high", evidenceIdA: "xcat_f", evidenceIdB: "xcat_r" }];
    const scores = calculateScores([financial, risk], contradictions);
    // Cross-category filter must suppress the penalty entirely
    expect(scores.contradictionPenalty).toBe(0);
  });

  it("INV-7: contradiction penalty cannot exceed maxContradictionPenalty regardless of count", () => {
    // 10 high-severity contradictions would be 10×15 = 150 without a cap
    const manyContradictions = Array.from({ length: 10 }, (_, i) => ({
      severity: "high",
      evidenceIdA: "ev_f1",
      evidenceIdB: "ev_b1",
    }));
    // Place both items in same category so filter passes
    const sameCatEvidence = [
      { ...baseSecFinancial, id: "ev_f1", category: "financial" as const },
      { ...baseSecFinancial, id: "ev_b1", category: "financial" as const, normalizedValue: 10 },
    ];
    const scores = calculateScores(sameCatEvidence, manyContradictions);
    expect(scores.contradictionPenalty).toBeLessThanOrEqual(25);
  });

  it("INV-8: null final score when insufficient, even with partial evidence", () => {
    const scores = calculateScores(fullEvidence, [], false);
    expect(scores.final).toBeNull();
    expect(scores.decision).toBeNull();
    // Ledger is still produced for diagnostics
    expect(scores.contributionLedger.length).toBe(fullEvidence.length);
  });
});



describe("Context Compressor Tests", () => {
  const dummySec: Evidence = {
    id: "sec_1",
    researchId: "run_1",
    claim: "SEC filing fact",
    category: "financial",
    sourceType: "sec",
    confidence: 0.9,
    sourceQuality: 1.0,
    agentId: "financial_agent",
    createdAt: new Date().toISOString(),
  };

  const dummyLlm: Evidence = {
    id: "llm_1",
    researchId: "run_1",
    claim: "LLM interpretation",
    category: "news",
    sourceType: "llm_inference",
    confidence: 0.8,
    sourceQuality: 0.35,
    agentId: "news_agent",
    createdAt: new Date().toISOString(),
  };

  it("should prioritize SEC over LLM inference", () => {
    const compressed = compressContext([dummyLlm, dummySec]);
    expect(compressed[0].sourceType).toBe("sec");
  });

  it("should respect size limits and select relevant categories first", () => {
    const longSec: Evidence = {
      ...dummySec,
      id: "sec_long",
      claim: "X".repeat(500),
    };
    const compressed = compressContext([longSec, dummyLlm], { maxCharacters: 150 });
    // Stringified representation of longSec is > 150 chars, but dummyLlm is shorter and fits.
    expect(compressed.length).toBeLessThan(2);
  });
});
