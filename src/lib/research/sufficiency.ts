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

  // 1. Gather counts by category
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

  // 2. Identify agent failures
  const financialRun = agentRuns.find((r) => r.agentId === "financial");
  const secRun = agentRuns.find((r) => r.agentId === "sec");
  const macroRun = agentRuns.find((r) => r.agentId === "macro");
  const earningsRun = agentRuns.find((r) => r.agentId === "earnings");

  // Check critical failures
  const criticalAgentFailed = financialRun?.status === "failed" || (isUSAsset && secRun?.status === "failed");

  // 3. Enforce sufficiency rules
  if (evidenceList.length === 0) {
    reasons.push("NO_EVIDENCE");
  }

  if (financialCount === 0) {
    reasons.push("NO_FINANCIAL_EVIDENCE");
  }

  if (categoriesWithEvidence < 2 && evidenceList.length > 0) {
    reasons.push("INSUFFICIENT_CATEGORY_COVERAGE");
  }

  if (criticalAgentFailed) {
    reasons.push("CRITICAL_AGENT_FAILURES");
  }

  // 4. Determine outcome & sufficiency
  const sufficient = reasons.length === 0;
  
  // If critical agents failed but some other data was fetched, it could be a provider_failure outcome.
  // Otherwise, it's insufficient_evidence.
  let outcome: "sufficient" | "insufficient_evidence" | "provider_failure" = "sufficient";
  if (!sufficient) {
    const isNetworkError = agentRuns.some((r) => 
      r.status === "failed" && 
      (r.errorMessage?.includes("rate limit") || r.errorMessage?.includes("429") || r.errorMessage?.includes("timeout") || r.errorMessage?.includes("fetch"))
    );
    outcome = isNetworkError ? "provider_failure" : "insufficient_evidence";
  }

  // 5. Gather research limitations (useful context for the frontend, NOT blocking verdicts)
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
