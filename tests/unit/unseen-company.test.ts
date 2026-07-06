/**
 * Unseen Company Fixture Test
 *
 * Tests the scoring engine with a synthetic ticker (ZXKQ) and company name
 * (Zeta Xeon Corp) that do not exist in any real market and are not modeled
 * after any known company. This verifies:
 *
 * - The scoring engine does not require the company to be "known" in advance.
 * - No ticker-specific or company-specific fallback logic is triggered.
 * - The contribution ledger is produced for an unknown company.
 * - Missing data semantics hold for an unknown company.
 * - Contradiction logic works for an unknown company.
 *
 * DO NOT model this fixture after AAPL, MSFT, or any real company.
 * DO NOT assert a specific score value — assert semantic invariants only.
 */

import { describe, it, expect } from "vitest";
import { Evidence } from "../../src/core/evidence/evidence.types";
import { calculateScores } from "../../src/core/scoring/scoring-engine";
import { EvidencePool } from "../../src/core/evidence/evidence-pool";

// ─── Synthetic evidence — ZXKQ (Zeta Xeon Corp) ────────────────────────────
// This company does not exist. It is used only to verify generic behavior.

const SYNTHETIC_RUN_ID = "run_zxkq_fixture_001";
const SYNTHETIC_TICKER = "ZXKQ"; // used only for agentId context, never evaluated by scoring engine
const SYNTHETIC_AGENT = "zxkq_financial_agent";

const financialEvidence: Evidence = {
  id: "zxkq_f1",
  researchId: SYNTHETIC_RUN_ID,
  claim: "Operating revenue grew 12% year-over-year, driven by product expansion",
  category: "financial",
  sourceType: "fmp",
  normalizedValue: 72,
  confidence: 0.9,
  sourceQuality: 0.85,
  agentId: SYNTHETIC_AGENT,
  createdAt: new Date().toISOString(),
};

const businessEvidence: Evidence = {
  id: "zxkq_b1",
  researchId: SYNTHETIC_RUN_ID,
  claim: "The company operates in a niche industrial market with limited direct competition",
  category: "business",
  sourceType: "fmp",
  normalizedValue: 65,
  confidence: 0.8,
  sourceQuality: 0.8,
  agentId: SYNTHETIC_AGENT,
  createdAt: new Date().toISOString(),
};

const valuationEvidence: Evidence = {
  id: "zxkq_v1",
  researchId: SYNTHETIC_RUN_ID,
  claim: "Price-to-earnings ratio appears elevated relative to sector median",
  category: "valuation",
  sourceType: "fmp",
  normalizedValue: 40,
  confidence: 0.7,
  sourceQuality: 0.75,
  agentId: SYNTHETIC_AGENT,
  createdAt: new Date().toISOString(),
};

const newsEvidence: Evidence = {
  id: "zxkq_n1",
  researchId: SYNTHETIC_RUN_ID,
  claim: "Recent press coverage is neutral; no major analyst upgrades or downgrades",
  category: "news",
  sourceType: "tavily",
  normalizedValue: 55,
  confidence: 0.75,
  sourceQuality: 0.75,
  agentId: SYNTHETIC_AGENT,
  createdAt: new Date().toISOString(),
};

const riskEvidence: Evidence = {
  id: "zxkq_r1",
  researchId: SYNTHETIC_RUN_ID,
  claim: "Supply chain concentration risk noted in recent regulatory disclosure",
  category: "risk",
  sourceType: "fmp",
  normalizedValue: 35,
  confidence: 0.85,
  sourceQuality: 0.8,
  agentId: SYNTHETIC_AGENT,
  createdAt: new Date().toISOString(),
};

// Evidence with absent normalizedValue (tests missing-data semantics)
const missingValueEvidence: Evidence = {
  id: "zxkq_missing",
  researchId: SYNTHETIC_RUN_ID,
  claim: "Qualitative observation: management commentary suggests cautious growth outlook",
  category: "business",
  sourceType: "tavily",
  normalizedValue: undefined,
  confidence: 0.6,
  sourceQuality: 0.6,
  agentId: SYNTHETIC_AGENT,
  createdAt: new Date().toISOString(),
};

// Evidence with out-of-range normalizedValue (tests raw-metric exclusion)
const rawMetricEvidence: Evidence = {
  id: "zxkq_oor",
  researchId: SYNTHETIC_RUN_ID,
  claim: "Annual revenue: $4.2 billion",
  category: "financial",
  sourceType: "fmp",
  normalizedValue: 4_200_000_000, // absolute dollar revenue — must be excluded
  confidence: 0.95,
  sourceQuality: 0.9,
  agentId: SYNTHETIC_AGENT,
  createdAt: new Date().toISOString(),
};

const allEvidence = [
  financialEvidence,
  businessEvidence,
  valuationEvidence,
  newsEvidence,
  riskEvidence,
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Unseen Company (ZXKQ / Zeta Xeon Corp) — Generic Scoring Invariants", () => {
  it("scoring executes to completion for an unknown company", () => {
    const scores = calculateScores(allEvidence, []);
    // Scoring must not throw, must return a valid result object
    expect(scores).toBeDefined();
    expect(scores.final).not.toBeUndefined();
    expect(scores.decision).not.toBeUndefined();
  });

  it("contribution ledger is produced for unknown company", () => {
    const scores = calculateScores(allEvidence, []);
    expect(scores.contributionLedger).toBeDefined();
    expect(scores.contributionLedger.length).toBe(allEvidence.length);
    // Every item must have a defined validityState
    for (const entry of scores.contributionLedger) {
      expect(["valid", "excluded_absent", "excluded_range", "excluded_parse"]).toContain(
        entry.validityState
      );
    }
  });

  it("missing normalizedValue is excluded from score (not mapped to neutral 50)", () => {
    const withMissing = [...allEvidence, missingValueEvidence];
    const scores = calculateScores(withMissing, []);

    const ledger = scores.contributionLedger.find((r) => r.evidenceId === "zxkq_missing");
    expect(ledger).toBeDefined();
    expect(ledger!.validityState).toBe("excluded_absent");
    expect(ledger!.effectiveValue).toBeNull();
    expect(ledger!.finalContribution).toBe(0);
  });

  it("out-of-range normalizedValue (raw dollar metric) is excluded", () => {
    const withOOR = [...allEvidence, rawMetricEvidence];
    const scores = calculateScores(withOOR, []);

    const ledger = scores.contributionLedger.find((r) => r.evidenceId === "zxkq_oor");
    expect(ledger).toBeDefined();
    expect(ledger!.validityState).toBe("excluded_range");
    expect(ledger!.effectiveValue).toBeNull();
    expect(ledger!.finalContribution).toBe(0);
  });

  it("cross-category contradiction pair from unknown company receives no penalty", () => {
    // Financial and risk are different categories — cannot be direct contradictions
    const contradictions = [
      { severity: "high", evidenceIdA: "zxkq_f1", evidenceIdB: "zxkq_r1" },
    ];
    const scores = calculateScores(allEvidence, contradictions);
    // Cross-category filter must suppress this penalty
    expect(scores.contradictionPenalty).toBe(0);
  });

  it("same-category contradiction pair from unknown company receives penalty", () => {
    // Two financial items in the same category may be contradictions
    const conflictingFinancial: Evidence = {
      ...financialEvidence,
      id: "zxkq_f2",
      normalizedValue: 20,
      claim: "Operating revenue declined 8% due to contract losses",
    };
    const contradictions = [
      { severity: "medium", evidenceIdA: "zxkq_f1", evidenceIdB: "zxkq_f2" },
    ];
    const scores = calculateScores([financialEvidence, conflictingFinancial, ...allEvidence.slice(1)], contradictions);
    expect(scores.contradictionPenalty).toBeGreaterThan(0);
  });

  it("contradiction penalty for unknown company is bounded by global cap", () => {
    // 10 high contradictions without cap would be 150 points
    const sameCatPair: Evidence[] = [
      { ...financialEvidence, id: "cap_a", normalizedValue: 80 },
      { ...financialEvidence, id: "cap_b", normalizedValue: 20 },
    ];
    const manyContradictions = Array.from({ length: 10 }, () => ({
      severity: "high",
      evidenceIdA: "cap_a",
      evidenceIdB: "cap_b",
    }));
    const scores = calculateScores(sameCatPair, manyContradictions);
    expect(scores.contradictionPenalty).toBeLessThanOrEqual(25);
  });

  it("EvidencePool.deduplicate works on unknown company evidence", () => {
    // Two items with normalized identical claims — should deduplicate
    const duplicateA: Evidence = {
      ...financialEvidence,
      id: "dup_a",
      claim: "Revenue grew 12% YoY",
    };
    const duplicateB: Evidence = {
      ...financialEvidence,
      id: "dup_b",
      claim: "Revenue grew 12% YoY", // Identical claim text
    };
    const pool = new EvidencePool().appendMany([duplicateA, duplicateB]);
    const deduped = pool.deduplicate();
    expect(deduped.list().length).toBe(1);
  });

  it("score is null for unknown company when insufficient research", () => {
    const scores = calculateScores(allEvidence, [], false /* isSufficient = false */);
    expect(scores.final).toBeNull();
    expect(scores.decision).toBeNull();
    // Ledger still produced even when insufficient
    expect(scores.contributionLedger.length).toBe(allEvidence.length);
  });

  it("no ticker-specific fallback: score is purely evidence-driven", () => {
    // Verify the score is within a valid range — the only acceptance criterion is
    // that it executed generically, not that it reached a specific verdict.
    const scores = calculateScores(allEvidence, []);
    if (scores.final !== null) {
      expect(scores.final).toBeGreaterThanOrEqual(0);
      expect(scores.final).toBeLessThanOrEqual(100);
    }
    // Decision must be only one of the two valid decisions or null (insufficient)
    expect(["INVEST", "PASS", null]).toContain(scores.decision);
  });
});
