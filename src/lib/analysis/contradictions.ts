import "server-only";
import { Evidence } from "@/src/core/evidence/evidence.types";
import { MetricTrends } from "./metrics";

export interface ContradictionAuditResult {
  evidenceIdA: string;
  evidenceIdB: string;
  description: string;
  severity: "low" | "medium" | "high";
  confidence: number;
}

export function runDeterministicContradictionAudit(
  evidenceList: readonly Evidence[],
  trends: MetricTrends,
  multiples: { peRatio?: number }
): ContradictionAuditResult[] {
  const auditResults: ContradictionAuditResult[] = [];

  // Helper to find evidence by keywords
  const findEvidenceByKeyword = (keywords: string[], category?: string): Evidence | null => {
    return evidenceList.find(e => {
      const claimLower = e.claim.toLowerCase();
      const matchesKeyword = keywords.some(kw => claimLower.includes(kw));
      const matchesCategory = category ? e.category === category : true;
      return matchesKeyword && matchesCategory;
    }) || null;
  };

  // Pattern 1: Revenue growth contradiction
  // Check if LLM claim asserts "high revenue growth" (>20%) but FMP actual revenue growth was low or negative
  const revGrowthEvidence = findEvidenceByKeyword(["revenue growth", "revenue grew", "sales grew"], "financial");
  if (revGrowthEvidence) {
    const cagr = trends.revenueCAGR !== null ? trends.revenueCAGR : 0.05;
    if (cagr < 0.03) {
      const claimLower = revGrowthEvidence.claim.toLowerCase();
      if (claimLower.includes("high") || claimLower.includes("rapid") || claimLower.includes("strong") || claimLower.includes("20%")) {
        auditResults.push({
          evidenceIdA: revGrowthEvidence.id,
          evidenceIdB: revGrowthEvidence.id, // Self-flagged mismatch to metric
          description: `Asset asserts strong revenue growth, but actual FMP/SEC CAGR is low/negative at ${(cagr * 100).toFixed(2)}%.`,
          severity: "high",
          confidence: 0.9,
        });
      }
    }
  }

  // Pattern 2: Debt-free contradiction
  // Check if assertions say "debt-free" or "low debt" but FMP debt-to-equity is high (> 1.5)
  const debtEvidence = findEvidenceByKeyword(["debt-free", "no debt", "low debt", "clean balance sheet"]);
  const lastDE = trends.debtToEquity.length > 0 ? trends.debtToEquity[trends.debtToEquity.length - 1] : 0;
  if (debtEvidence && lastDE > 1.5) {
    auditResults.push({
      evidenceIdA: debtEvidence.id,
      evidenceIdB: debtEvidence.id,
      description: `Claim asserts low/no debt, but FMP metrics show a high Debt-to-Equity ratio of ${lastDE.toFixed(2)}.`,
      severity: "high",
      confidence: 0.95,
    });
  }

  // Pattern 3: Moat vs Margin contradiction
  // Claims of "wide moat" or "industry leader margins" but gross margin is low (<20%) or falling rapidly
  const moatEvidence = findEvidenceByKeyword(["wide moat", "high gross margin", "pricing power"]);
  const lastGross = trends.margins.gross.length > 0 ? trends.margins.gross[trends.margins.gross.length - 1] : 0.5;
  if (moatEvidence && lastGross < 0.20) {
    auditResults.push({
      evidenceIdA: moatEvidence.id,
      evidenceIdB: moatEvidence.id,
      description: `Claim asserts strong pricing power or wide moat, but gross margin is very low at ${(lastGross * 100).toFixed(2)}%.`,
      severity: "medium",
      confidence: 0.85,
    });
  }

  // Pattern 4: Valuation contradiction
  // Claims of "cheap" or "undervalued" but PE multiple is very high (> 35)
  const valuationEvidence = findEvidenceByKeyword(["cheap", "undervalued", "low valuation", "bargain"], "valuation");
  const pe = multiples.peRatio || 0;
  if (valuationEvidence && pe > 35) {
    auditResults.push({
      evidenceIdA: valuationEvidence.id,
      evidenceIdB: valuationEvidence.id,
      description: `Claim asserts stock is cheap or undervalued, but actual P/E ratio is high at ${pe.toFixed(2)}.`,
      severity: "medium",
      confidence: 0.9,
    });
  }

  // Pattern 5: Cash flow contradiction
  // Claims of "strong cash flow" but actual FCF trend shows negative FCF in the last year
  const cashFlowEvidence = findEvidenceByKeyword(["cash flow", "fcf", "cash generator"]);
  const lastFCF = trends.fcfTrend.length > 0 ? trends.fcfTrend[trends.fcfTrend.length - 1] : 100;
  if (cashFlowEvidence && lastFCF < 0) {
    auditResults.push({
      evidenceIdA: cashFlowEvidence.id,
      evidenceIdB: cashFlowEvidence.id,
      description: `Claim asserts strong cash flow generation, but last year Free Cash Flow is negative: $${(lastFCF / 1e6).toFixed(2)}M.`,
      severity: "high",
      confidence: 0.9,
    });
  }

  // Pattern 6: Gross margin variance between sources (e.g. SEC vs Tavily news claims)
  // Cross-reference any evidence items that both claim specific gross margins
  const marginEvidenceItems = evidenceList.filter(e => e.claim.toLowerCase().includes("gross margin"));
  if (marginEvidenceItems.length >= 2) {
    const itemA = marginEvidenceItems[0];
    const itemB = marginEvidenceItems[1];
    const valA = parseFloat(itemA.claim.replace(/[^0-9.]/g, ""));
    const valB = parseFloat(itemB.claim.replace(/[^0-9.]/g, ""));
    if (!isNaN(valA) && !isNaN(valB) && Math.abs(valA - valB) > 5) {
      auditResults.push({
        evidenceIdA: itemA.id,
        evidenceIdB: itemB.id,
        description: `Source conflict: One source claims gross margin is ${valA}%, another claims ${valB}%.`,
        severity: "medium",
        confidence: 0.85,
      });
    }
  }

  return auditResults;
}
