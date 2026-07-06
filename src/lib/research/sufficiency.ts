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
}

interface AgentRunLike {
  agentId: string;
  status: string;
  errorMessage: string | null;
}

export const MIN_RESEARCH_COVERAGE = 0.50;

/**
 * Assesses whether the gathered evidence is sufficient to compile a valid scoring and investment verdict.
 */
export function checkSufficiency(
  evidenceList: readonly EvidenceLike[],
  agentRuns: readonly AgentRunLike[],
  isUSAsset: boolean
): SufficiencyResult {
  const reasons: string[] = [];
  const limitations: string[] = [];

  // 1. Calculate successful research area ratio
  const completedAgents = agentRuns.filter(
    (r) => r.status === "completed" && ["financial", "sec", "macro", "earnings"].includes(r.agentId)
  );
  const completedAreasCount = completedAgents.length;
  const successfulResearchAreaRatio = completedAreasCount / 4.0;

  // 2. Calculate evidence category coverage ratio (5 categories: business, financial, valuation, news, risk)
  const financialCount = evidenceList.filter((e) => e.category === "financial").length;
  const businessCount = evidenceList.filter((e) => e.category === "business").length;
  const valuationCount = evidenceList.filter((e) => e.category === "valuation").length;
  const newsCount = evidenceList.filter((e) => e.category === "news").length;
  const riskCount = evidenceList.filter((e) => e.category === "risk").length;

  const categoriesWithEvidence = [
    financialCount > 0,
    businessCount > 0,
    valuationCount > 0,
    newsCount > 0,
    riskCount > 0,
  ].filter(Boolean).length;
  const evidenceCategoryCoverageRatio = categoriesWithEvidence / 5.0;

  // 3. Calculate source diversity ratio (4 source groups: fmp, sec, tavily, alpha_vantage)
  const uniqueSources = new Set(
    evidenceList
      .map((e) => e.sourceType.toLowerCase())
      .filter((s) => ["sec", "fmp", "tavily", "alpha_vantage"].includes(s))
  );
  const sourceDiversityRatio = uniqueSources.size / 4.0;

  // 4. Calculate coverage score
  const coverage = 0.5 * successfulResearchAreaRatio + 0.3 * evidenceCategoryCoverageRatio + 0.2 * sourceDiversityRatio;

  // 5. Enforce sufficiency rules
  if (completedAreasCount < 2) {
    reasons.push("INSUFFICIENT_SPECIALIST_COVERAGE");
  }

  if (uniqueSources.size < 2) {
    reasons.push("INSUFFICIENT_SOURCE_DIVERSITY");
  }

  if (coverage < MIN_RESEARCH_COVERAGE) {
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

  // 6. Gather research limitations
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
