import "server-only";
import { EvidenceBundle } from "../research/buildEvidenceBundle";
import { CompanyMarketSnapshot, CategoryAssessments } from "../../types/snapshot";
import { z } from "zod";

export const openRouterAnalysisSchema = z.object({
  investmentScore: z.number().min(0).max(100),
  verdict: z.enum(["INVEST", "PASS"]),
  confidence: z.number().min(0).max(100),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  riskFactors: z.array(z.string()),
  summary: z.string(),

  // Expanded Rich Internal Evaluation Fields
  evidenceStrength: z.string(),
  evidenceConsistency: z.string(),
  majorSupportingFactors: z.array(z.string()),
  majorConcerns: z.array(z.string()),
  keyRisks: z.array(z.string()),
  missingEvidence: z.array(z.string()),
  decisionRationale: z.string(),
  overallConfidence: z.number().min(0).max(100),
  finalVerdict: z.enum(["INVEST", "PASS"]),
});

export type OpenRouterAnalysisOutput = z.infer<typeof openRouterAnalysisSchema>;

export interface GeminiLLMAnalysisResult {
  provider: "gemini";
  status: "success" | "rate_limit" | "auth_error" | "timeout" | "network_error" | "schema_failure" | "provider_error" | "not_called";
  durationMs: number;
  model: string;
  data: OpenRouterAnalysisOutput | null;
  message?: string;
}

export async function runGeminiAnalysis(
  bundle: EvidenceBundle,
  snapshot: CompanyMarketSnapshot,
  categoryAssessments: CategoryAssessments,
  simulate?: "rate_limit" | "auth_error" | "timeout" | "schema_failure" | "provider_error"
): Promise<GeminiLLMAnalysisResult> {
  const startTime = Date.now();
  const modelName = "gemini-2.5-flash-mock";

  if (simulate) {
    return {
      provider: "gemini",
      status: simulate,
      durationMs: Date.now() - startTime,
      model: modelName,
      data: null,
      message: `Simulated Gemini error: ${simulate}`,
    };
  }

  // Local deterministic mock analysis of categoryAssessments
  const finCapacity = categoryAssessments.financialCapacity?.status || "unavailable";
  const cashFlowStatus = categoryAssessments.cashFlow?.status || "unavailable";
  const priceHistoryStatus = categoryAssessments.priceHistory?.status || "unavailable";
  const newsStatus = categoryAssessments.news?.status || "unavailable";

  const isInvest = finCapacity === "strong" && cashFlowStatus === "positive" && priceHistoryStatus === "sufficient";
  const verdict = isInvest ? "INVEST" : "PASS";
  const investmentScore = isInvest ? 85 : 45;
  const confidence = isInvest ? 90 : 70;

  const pros: string[] = [];
  const cons: string[] = [];
  const riskFactors: string[] = [];

  if (finCapacity === "strong") {
    pros.push("Strong financial capacity on the balance sheet.");
  } else {
    cons.push("Financial capacity is weak or moderate.");
    riskFactors.push("High leverage or weak current assets relative to liabilities.");
  }

  if (cashFlowStatus === "positive") {
    pros.push("Operating cash flow is healthy and positive.");
  } else {
    cons.push("Weak cash flow generation capability.");
  }

  if (priceHistoryStatus === "sufficient") {
    pros.push("Consistent and sufficient 2-3 year historical price trend.");
  } else {
    cons.push("Insufficient price trend history.");
  }

  if (newsStatus === "positive") {
    pros.push("Recent market news sentiment is predominantly positive.");
  } else if (newsStatus === "negative") {
    cons.push("Recent market news contains negative signals.");
    riskFactors.push("Adverse news headlines and public sentiment.");
  }

  const summary = `Local Mock Gemini Analysis: Evaluated ${snapshot.company.name} (${snapshot.company.ticker}) to be a ${verdict} based on pre-compiled category metrics. Financial Capacity: ${finCapacity}, Cash Flow: ${cashFlowStatus}.`;

  const durationMs = Date.now() - startTime;

  return {
    provider: "gemini",
    status: "success",
    durationMs,
    model: modelName,
    data: {
      investmentScore,
      verdict,
      confidence,
      pros,
      cons,
      riskFactors,
      summary,
      evidenceStrength: `Heuristic assessment indicates ${isInvest ? "strong" : "mixed/weak"} evidence support.`,
      evidenceConsistency: `Cross-provider metrics show high alignment with pre-calculated assessments.`,
      majorSupportingFactors: pros,
      majorConcerns: cons,
      keyRisks: riskFactors,
      missingEvidence: [],
      decisionRationale: summary,
      overallConfidence: confidence,
      finalVerdict: verdict,
    },
  };
}
