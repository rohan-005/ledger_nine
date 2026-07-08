import "server-only";
import { EvidenceBundle } from "./buildEvidenceBundle";
import { runGroqAnalysis, LLMAnalysisResult, AnalysisOutput } from "../providers/groq";
import { CompanyMarketSnapshot, CategoryAssessments } from "../../types/snapshot";

export interface AnalysisRunResult {
  status: "success" | "unavailable";
  analysisMode: "llm" | "unavailable";
  selectedProvider: "groq" | null;
  data: AnalysisOutput | null;
  attempts: {
    provider: "groq";
    status: LLMAnalysisResult["status"];
    durationMs: number;
    model: string;
    message?: string;
  }[];
  message?: string;

  // Legacy fields for backward compatibility with frontend rendering
  activeProvider: "groq" | null;
  groq: LLMAnalysisResult;
  analysis: AnalysisOutput | null;
}

/**
 * Runs the LLM analysis via Groq. Gemini is removed.
 */
export async function runCompanyAnalysis(
  bundle: EvidenceBundle,
  snapshot: CompanyMarketSnapshot,
  categoryAssessments: CategoryAssessments,
  simulate?: {
    groq?: "rate_limit" | "auth_error" | "timeout" | "schema_failure" | "provider_error";
  }
): Promise<AnalysisRunResult> {
  const attempts: AnalysisRunResult["attempts"] = [];

  // Call Groq Analysis
  const groqResult = await runGroqAnalysis(bundle, snapshot, categoryAssessments, simulate?.groq);
  
  attempts.push({
    provider: "groq",
    status: groqResult.status,
    durationMs: groqResult.durationMs,
    model: groqResult.model,
    message: groqResult.message,
  });

  if (groqResult.status === "success" && groqResult.data) {
    return {
      status: "success",
      analysisMode: "llm",
      selectedProvider: "groq",
      data: groqResult.data,
      attempts,
      activeProvider: "groq",
      groq: groqResult,
      analysis: groqResult.data,
    };
  }

  // Fallback to Unavailable State if Groq fails (Strictly no deterministic summary fallback)
  return {
    status: "unavailable",
    analysisMode: "unavailable",
    selectedProvider: null,
    data: null,
    attempts,
    activeProvider: null,
    groq: groqResult,
    analysis: null,
    message: "Groq AI analysis failed or returned invalid schema.",
  };
}
