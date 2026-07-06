import "server-only";

export interface SufficiencyResult {
  sufficient: boolean;
  outcome: "sufficient" | "insufficient_evidence" | "provider_failure";
  reasons: string[];
  limitations: string[];
}

interface EvidenceLike {
  id: string;
  category: string;
  sourceType: string;
  claim: string;
}

interface AgentRunLike {
  agentId: string;
  status: string;
  errorMessage: string | null;
}

/**
 * Assesses whether the gathered evidence is sufficient to compile a valid scoring and investment verdict.
 * New gate eligibility rules:
 * A. Company identity is resolved (assumed true if we reach here)
 * B. At least 3 annual financial periods are available (financialCount >= 3)
 * C. At least one of: valuation data, market data, recent news, targeted web research.
 */
export function checkSufficiency(
  evidenceList: readonly EvidenceLike[],
  agentRuns: readonly AgentRunLike[],
  isUSAsset: boolean
): SufficiencyResult {
  const reasons: string[] = [];
  const limitations: string[] = [];

  const financialCount = evidenceList.filter((e) => e.category === "financial").length;
  const businessCount = evidenceList.filter((e) => e.category === "business").length;
  const valuationCount = evidenceList.filter((e) => e.category === "valuation").length;
  const newsCount = evidenceList.filter((e) => e.category === "news").length;
  const riskCount = evidenceList.filter((e) => e.category === "risk").length;

  const hasFinancials = financialCount >= 3;
  const hasValuation = valuationCount > 0;
  const hasMarketData = evidenceList.some((e) => 
    e.claim?.toLowerCase().includes("market quote") || 
    e.claim?.toLowerCase().includes("share price") || 
    e.claim?.toLowerCase().includes("price of") ||
    e.claim?.toLowerCase().includes("quote")
  );
  const hasNews = newsCount > 0;
  const hasWebResearch = businessCount > 0 || riskCount > 0 || evidenceList.some(e => e.category === "competitor");

  const hasAdditionalData = hasValuation || hasMarketData || hasNews || hasWebResearch;

  if (!hasFinancials) {
    reasons.push("INSUFFICIENT_SPECIALIST_COVERAGE");
  }

  if (!hasAdditionalData) {
    reasons.push("INSUFFICIENT_COVERAGE_SCORE");
  }

  const sufficient = reasons.length === 0;
  
  let outcome: "sufficient" | "insufficient_evidence" | "provider_failure" = "sufficient";
  if (!sufficient) {
    const isNetworkError = agentRuns.some((r) => 
      r.status === "failed" && 
      (r.errorMessage?.includes("rate limit") || r.errorMessage?.includes("429") || r.errorMessage?.includes("timeout") || r.errorMessage?.includes("fetch"))
    );
    outcome = isNetworkError ? "provider_failure" : "insufficient_evidence";
  }

  // Gather research limitations
  const secRun = agentRuns.find((r) => r.agentId === "sec");
  const macroRun = agentRuns.find((r) => r.agentId === "macro");
  const earningsRun = agentRuns.find((r) => r.agentId === "earnings");

  if (secRun?.status === "skipped") {
    limitations.push("SEC regulatory filings research skipped (non-US asset).");
  } else if (secRun?.status === "failed") {
    limitations.push("SEC Agent execution failed: Regulatory filings could not be parsed.");
  }

  if (macroRun?.status === "failed") {
    limitations.push("Macro News Agent failed: Latest industry outlook & competitors news might be missing.");
  }

  if (earningsRun?.status === "failed") {
    limitations.push("Earnings Call Agent failed: Transcript sentiment & guidance metrics unavailable.");
  }

  return {
    sufficient,
    outcome,
    reasons,
    limitations,
  };
}
