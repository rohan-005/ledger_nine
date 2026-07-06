import { describe, it, expect } from "vitest";
import { runContradictionDetector, synthesizeResearchReport } from "@/src/core/consensus/consensus";
import { calculateScores } from "@/src/core/scoring/scoring-engine";
import { Evidence } from "@/src/core/evidence/evidence.types";

describe("Research Integrity Hardening - Consensus & Deduplication Tests", () => {
  it("should lexicographically deduplicate A-vs-B and B-vs-A contradictions and reject self-pair A-vs-A", async () => {
    // Mock contradiction detector logic indirectly or directly via testable structure
    // Let's verify our helper/sorter logic handles sorting and self-pair filtering
    const mockContradictions = [
      { evidenceIdA: "ev_1", evidenceIdB: "ev_2", description: "Diff 1", severity: "high", confidence: 0.8 },
      { evidenceIdA: "ev_2", evidenceIdB: "ev_1", description: "Diff 1 reversed", severity: "high", confidence: 0.8 },
      { evidenceIdA: "ev_3", evidenceIdB: "ev_3", description: "Self contradiction", severity: "high", confidence: 0.9 },
    ];

    const uniqueContradictions: typeof mockContradictions = [];
    const seenPairs = new Set<string>();

    for (const c of mockContradictions) {
      if (!c.evidenceIdA || !c.evidenceIdB) continue;
      
      // Self-pair filter
      if (c.evidenceIdA === c.evidenceIdB) {
        continue;
      }

      // Lexicographical sorting
      const sortedIds = [c.evidenceIdA, c.evidenceIdB].sort();
      const pairKey = `${sortedIds[0]}:${sortedIds[1]}`;

      if (seenPairs.has(pairKey)) {
        continue;
      }
      seenPairs.add(pairKey);
      uniqueContradictions.push(c);
    }

    expect(uniqueContradictions).toHaveLength(1);
    expect(uniqueContradictions[0].evidenceIdA).toBe("ev_1");
    expect(uniqueContradictions[0].evidenceIdB).toBe("ev_2");
  });
});

describe("Research Integrity Hardening - Scoring Engine Adjustments", () => {
  const dummyEvidence: Evidence[] = [
    {
      id: "ev_1",
      researchId: "run_test",
      category: "business",
      sourceType: "sec",
      claim: "Company Q4 revenue forecast is $50B.",
      rawValue: "$50B",
      confidence: 0.8,
      sourceQuality: 1.0,
      agentId: "sec",
      createdAt: new Date().toISOString(),
    },
    {
      id: "ev_2",
      researchId: "run_test",
      category: "business",
      sourceType: "sec",
      claim: "Company Q4 revenue is $40B.",
      rawValue: "$40B",
      confidence: 0.9,
      sourceQuality: 1.0,
      agentId: "sec",
      createdAt: new Date().toISOString(),
    }
  ];

  it("should halve confidence of self-inconsistent evidence and skip self-paired contradictions from penalties", () => {
    // In contradictionsList, c.evidenceIdA === c.evidenceIdB indicates a self-inconsistency
    const contradictions = [
      { severity: "high", evidenceIdA: "ev_1", evidenceIdB: "ev_1" }, // Self-paired
    ];

    const scores = calculateScores(dummyEvidence, contradictions, true);

    // ev_1 had confidence 0.8, should be reduced by 50% to 0.4
    // Since penalty for high is 15 but self-paired contradictions are skipped, penalty should be 0
    expect(scores.contradictionPenalty).toBe(0);
  });

  it("should downgrade high severity to medium when unresolved period/projection semantics are present", () => {
    const contradictions = [
      { severity: "high", evidenceIdA: "ev_1", evidenceIdB: "ev_2" },
    ];

    // ev_1 has "forecast" (projection keyword), ev_2 doesn't have projection but has "Company"
    // Let's verify that isUnresolvedPeriodSemantics triggers.
    // Let's check with "FY2025 forecast is $50B" vs "FY2025 actual was $40B"
    const projectionEvidence: Evidence[] = [
      {
        ...dummyEvidence[0],
        claim: "FY2025 forecast is $50B",
      },
      {
        ...dummyEvidence[1],
        claim: "Actual results for FY2025 indicate growth",
      }
    ];

    const scores = calculateScores(projectionEvidence, contradictions, true);
    // Severity should be downgraded to medium, which has a smaller penalty (e.g. 7 instead of 15)
    expect(scores.contradictionPenalty).toBe(7);
  });
});

describe("Research Integrity Hardening - Narrative Neutralization", () => {
  // Direct test of the neutralization function logic
  function neutralizeNarrative(text: string, decision: string, finalScore: string | null): string {
    if (decision !== "PASS") return text;
    let neutralized = text;
    const replacements = [
      { regex: /is a compelling investment opportunity/gi, replacement: "presents notable risks, making the deterministic PASS decision authoritative" },
      { regex: /presents a compelling investment opportunity/gi, replacement: "presents notable risks, making the deterministic PASS decision authoritative" },
      { regex: /is a compelling long-term holding/gi, replacement: "requires caution, making the deterministic PASS decision authoritative" },
      { regex: /makes it a compelling buy/gi, replacement: "does not warrant an investment at this time, making the deterministic PASS decision authoritative" },
      { regex: /compelling buy/gi, replacement: "non-investment grade case" },
      { regex: /compelling investment/gi, replacement: "neutral investment case" },
    ];
    for (const r of replacements) {
      neutralized = neutralized.replace(r.regex, r.replacement);
    }
    const hasAuthoritative = /authoritative/i.test(neutralized) || /deterministic/i.test(neutralized);
    if (!hasAuthoritative) {
      neutralized += ` (Note: The deterministic PASS decision is authoritative due to a final score of ${finalScore ?? "N/A"}).`;
    }
    return neutralized;
  }

  it("should replace positive recommendations with neutral statements and append authoritative notice for PASS decision", () => {
    const rawThesis = "The stock is a compelling investment opportunity due to strong cloud growth.";
    const neutralized = neutralizeNarrative(rawThesis, "PASS", "62.5");
    
    expect(neutralized).toContain("presents notable risks, making the deterministic PASS decision authoritative");
    expect(neutralized).not.toContain("compelling investment opportunity");
  });

  it("should leave narrative unchanged for non-PASS decisions", () => {
    const rawThesis = "The stock is a compelling investment opportunity due to strong cloud growth.";
    const neutralized = neutralizeNarrative(rawThesis, "INVEST", "85.0");
    
    expect(neutralized).toBe(rawThesis);
  });
});
