import "server-only";
import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { getGroqApiKey } from "@/src/lib/env";
import { CompanyIdentity } from "../company/symbolCandidates";
import { EvidenceBundle, buildEvidenceBundle } from "./buildEvidenceBundle";
import { CompanyMarketSnapshot, CategoryAssessments } from "../../types/snapshot";
import { AnalysisOutput, analysisSchema } from "../providers/groq";
import { CURATED_COMPANIES } from "@/src/data/curatedCompanies";
import { runDiagnosticsPipeline } from "./fetchAllProviders";
import { runAllProviderHealthChecks } from "@/src/lib/providers/healthCheck";
import { buildSnapshot } from "./snapshotEngine";
import { compactEvidenceBundle } from "./compactPayload";
import { AnalysisRunResult } from "./llmAnalysis";

// Define the strongly typed LangGraph State using Annotation
export const ResearchStateAnnotation = Annotation.Root({
  ticker: Annotation<string>(),
  companyIdentity: Annotation<CompanyIdentity | null>(),
  diagnostics: Annotation<any | null>(),
  providerHealth: Annotation<any | null>(),
  evidenceBundle: Annotation<EvidenceBundle | null>(),
  snapshot: Annotation<CompanyMarketSnapshot | null>(),
  categoryAssessments: Annotation<CategoryAssessments | null>(),
  completeness: Annotation<{
    hasCompanyDetails: boolean;
    hasLatestPrice: boolean;
    hasPriceHistory: boolean;
    hasFinancialCapacity: boolean;
    hasCashFlow: boolean;
    hasRecentNews: boolean;
    hasMarketValue: boolean;
    score: number;
  } | null>(),
  simulate: Annotation<{ groq?: string } | undefined>(),
  interpretation: Annotation<AnalysisOutput | null>(),
  verdict: Annotation<"INVEST" | "PASS" | null>(),
  errors: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  status: Annotation<"success" | "unavailable">(),
  analysisRunResult: Annotation<AnalysisRunResult | null>(),
});

// --- GRAPH NODES ---

// 1. Resolve Company Node
async function resolveCompanyNode(state: typeof ResearchStateAnnotation.State) {
  const ticker = state.ticker;
  let companyIdentity = state.companyIdentity;
  const errors: string[] = [];

  if (!companyIdentity && ticker) {
    const tickerLower = ticker.toLowerCase();
    const found = CURATED_COMPANIES.find(
      (c) =>
        c.ticker.toLowerCase() === tickerLower ||
        c.canonicalTicker.toLowerCase() === tickerLower
    );

    if (found) {
      companyIdentity = {
        name: found.name,
        displayTicker: found.ticker,
        canonicalTicker: found.canonicalTicker,
        exchange: found.exchange,
        country: found.country,
        currency: found.country === "India" ? "INR" : "USD",
        isin: null,
      };
    } else {
      companyIdentity = {
        name: ticker,
        displayTicker: ticker,
        canonicalTicker: ticker,
        exchange: null,
        country: null,
        currency: null,
        isin: null,
      };
    }
  }

  if (!companyIdentity || !companyIdentity.displayTicker) {
    errors.push(`Failed to resolve company identity for ticker: ${ticker}`);
    return {
      companyIdentity: null,
      errors,
      status: "unavailable" as const,
    };
  }

  return {
    companyIdentity,
    status: "success" as const,
  };
}

// 2. Collect Evidence Node
async function collectEvidenceNode(state: typeof ResearchStateAnnotation.State) {
  if (state.status === "unavailable" || !state.companyIdentity) {
    return {};
  }
  const errors: string[] = [];
  try {
    const diagnostics = await runDiagnosticsPipeline(state.companyIdentity);
    const health = await runAllProviderHealthChecks(false);
    return {
      diagnostics,
      providerHealth: health,
    };
  } catch (error: any) {
    errors.push(`Failed to collect evidence: ${error.message || error}`);
    return {
      errors,
      status: "unavailable" as const,
    };
  }
}

// 3. Normalize Evidence Node
async function normalizeEvidenceNode(state: typeof ResearchStateAnnotation.State) {
  if (
    state.status === "unavailable" ||
    !state.companyIdentity ||
    !state.diagnostics ||
    !state.providerHealth
  ) {
    return {};
  }
  const errors: string[] = [];
  try {
    const evidenceBundle = buildEvidenceBundle(
      state.companyIdentity,
      state.diagnostics.allEndpoints,
      state.providerHealth.statusMap
    );
    return {
      evidenceBundle,
    };
  } catch (error: any) {
    errors.push(`Failed to normalize evidence: ${error.message || error}`);
    return {
      errors,
      status: "unavailable" as const,
    };
  }
}

// 4. Assess Categories Node
async function assessCategoriesNode(state: typeof ResearchStateAnnotation.State) {
  if (state.status === "unavailable" || !state.evidenceBundle) {
    return {};
  }
  const errors: string[] = [];
  try {
    const snapshot = buildSnapshot(state.evidenceBundle);
    return {
      snapshot,
      categoryAssessments: snapshot.categoryAssessments,
    };
  } catch (error: any) {
    errors.push(`Failed to assess categories: ${error.message || error}`);
    return {
      errors,
      status: "unavailable" as const,
    };
  }
}

// 5. Check Completeness Node
async function checkCompletenessNode(state: typeof ResearchStateAnnotation.State) {
  if (state.status === "unavailable" || !state.snapshot) {
    return {};
  }
  const snapshot = state.snapshot;
  const hasCompanyDetails = !!(snapshot.company.name && snapshot.company.ticker);
  const hasLatestPrice = snapshot.market.price !== null && snapshot.market.price > 0;
  const hasPriceHistory = snapshot.categoryAssessments.priceHistory.status === "sufficient";
  const hasFinancialCapacity = snapshot.categoryAssessments.financialCapacity.status !== "unavailable";
  const hasCashFlow = snapshot.categoryAssessments.cashFlow.status !== "unavailable";
  const hasRecentNews = snapshot.categoryAssessments.news.status !== "unavailable";
  const hasMarketValue = snapshot.categoryAssessments.marketValue.status !== "unavailable";

  const items = [
    hasCompanyDetails,
    hasLatestPrice,
    hasPriceHistory,
    hasFinancialCapacity,
    hasCashFlow,
    hasRecentNews,
    hasMarketValue,
  ];
  const score = Math.round((items.filter(Boolean).length / items.length) * 100);

  return {
    completeness: {
      hasCompanyDetails,
      hasLatestPrice,
      hasPriceHistory,
      hasFinancialCapacity,
      hasCashFlow,
      hasRecentNews,
      hasMarketValue,
      score,
    },
  };
}

// 6. Interpret Evidence Node (LangChain + Groq)
async function interpretEvidenceNode(state: typeof ResearchStateAnnotation.State) {
  if (
    state.status === "unavailable" ||
    !state.evidenceBundle ||
    !state.snapshot ||
    !state.categoryAssessments
  ) {
    return {};
  }

  const startTime = Date.now();
  const errors: string[] = [];

  const simulate = state.simulate?.groq;
  if (simulate) {
    errors.push(`Simulated Groq error: ${simulate}`);
    return {
      errors,
      status: "unavailable" as const,
    };
  }

  const apiKey = (() => {
    try {
      return getGroqApiKey();
    } catch {
      return null;
    }
  })();

  if (!apiKey) {
    errors.push("API key is not configured for Groq");
    return {
      errors,
      status: "unavailable" as const,
    };
  }

  try {
    const model = new ChatGroq({
      apiKey,
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
    });

    const compactedBundle = compactEvidenceBundle(state.evidenceBundle);

    const systemPrompt = `You are a professional financial diagnostics AI. Your task is to analyze the compacted company data bundle, local normalized snapshot, and transparent category assessments, then return a structured JSON response matching the required schema.

CRITICAL ROLE AND RULES:
1. STRICTLY QUALITATIVE ANALYSIS: You must NEVER invent or extrapolate any numerical facts (such as stock prices, EPS, revenues, profits, P/E, or cash flow ratios).
2. ONLY interpret the news, events, and qualitative textual evidence provided to you.
3. If any financial or market value is absent from the evidence, state that it is unavailable. Never infer or fabricate a financial value.
4. Ground every interpretation in the provided evidence. Cite evidence IDs (e.g. "ev_1", "ev_2") in the citedEvidenceIds array.
5. Identify conflicts between providers (e.g. trend disagreements or news contradictions) and output them in the conflicts array.
6. List any key metrics or periods missing from the evidence in the evidenceGaps array.
7. Synthesize these facts to make an independent evidence-grounded judgment and output a qualitative "verdict" (strictly "INVEST" or "PASS" - there is NO third option like WATCH or neutral) and a synthesized "finalScore" (0-100). If evidence is insufficient, weak, incomplete, contradictory, or too unreliable to justify investment, you MUST output a verdict of PASS. Keep all explanations and narrative fields short, direct, and to the point, avoiding unnecessary AI commentary.`;

    const userPrompt = `Here is the compacted factual evidence bundle:
${JSON.stringify(compactedBundle, null, 2)}

Here is the normalized snapshot compiled:
${JSON.stringify(state.snapshot, null, 2)}

Here are the pre-calculated Category Assessments:
${JSON.stringify(state.categoryAssessments, null, 2)}`;

    // Invoke ChatGroq with Structured Output using Zod
    const modelWithStructuredOutput = model.withStructuredOutput(analysisSchema);
    const response = await modelWithStructuredOutput.invoke([
      ["system", systemPrompt],
      ["user", userPrompt],
    ]);

    const durationMs = Date.now() - startTime;

    // Wrap in standard LLMAnalysisResult shape for attempts and compatibility
    const groqResult = {
      provider: "groq" as const,
      status: "success" as const,
      durationMs,
      model: "llama-3.3-70b-versatile",
      data: response as AnalysisOutput,
    };

    const attempts = [{
      provider: "groq" as const,
      status: "success" as const,
      durationMs,
      model: "llama-3.3-70b-versatile",
    }];

    const analysisRunResult: AnalysisRunResult = {
      status: "success",
      analysisMode: "llm",
      selectedProvider: "groq",
      data: response as AnalysisOutput,
      attempts,
      activeProvider: "groq",
      groq: groqResult,
      analysis: response as AnalysisOutput,
    };

    return {
      interpretation: response as AnalysisOutput,
      verdict: response.verdict as "INVEST" | "PASS",
      analysisRunResult,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    errors.push(`LangChain + ChatGroq execution failed: ${error.message || error}`);

    const groqResult = {
      provider: "groq" as const,
      status: "provider_error" as const,
      durationMs,
      model: "llama-3.3-70b-versatile",
      data: null,
      message: error.message || String(error),
    };

    const attempts = [{
      provider: "groq" as const,
      status: "provider_error" as const,
      durationMs,
      model: "llama-3.3-70b-versatile",
      message: error.message || String(error),
    }];

    const analysisRunResult: AnalysisRunResult = {
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

    return {
      errors,
      status: "unavailable" as const,
      analysisRunResult,
      verdict: "PASS" as const,
    };
  }
}

// 7. Validate Verdict Node
async function validateVerdictNode(state: typeof ResearchStateAnnotation.State) {
  if (state.status === "unavailable" || !state.interpretation || !state.analysisRunResult) {
    return {};
  }

  const interpretation = { ...state.interpretation };
  const errors: string[] = [];

  const validVerdicts = ["INVEST", "PASS"];
  if (!validVerdicts.includes(interpretation.verdict)) {
    errors.push(`Invalid verdict returned by LLM: ${interpretation.verdict}. Forcing PASS.`);
    interpretation.verdict = "PASS";
  }

  if (
    typeof interpretation.finalScore !== "number" ||
    interpretation.finalScore < 0 ||
    interpretation.finalScore > 100
  ) {
    errors.push(`Invalid score returned by LLM: ${interpretation.finalScore}. Clamping score.`);
    interpretation.finalScore = Math.max(0, Math.min(100, interpretation.finalScore || 0));
  }

  const updatedRunResult: AnalysisRunResult = {
    ...state.analysisRunResult,
    data: interpretation,
    analysis: interpretation,
    groq: {
      ...state.analysisRunResult.groq,
      data: interpretation,
    },
  };

  return {
    interpretation,
    verdict: interpretation.verdict as "INVEST" | "PASS",
    errors,
    analysisRunResult: updatedRunResult,
  };
}

// 8. Finalize Report Node
async function finalizeReportNode(state: typeof ResearchStateAnnotation.State) {
  if (state.status === "unavailable") {
    // Construct default unavailable run results if failed
    const attempts = state.analysisRunResult?.attempts || [];
    const groqResult = state.analysisRunResult?.groq || {
      provider: "groq" as const,
      status: "not_called" as const,
      durationMs: 0,
      model: "llama-3.3-70b-versatile",
      data: null,
      message: state.errors.join("; "),
    };

    const analysisRunResult: AnalysisRunResult = {
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

    return {
      verdict: "PASS" as const,
      analysisRunResult,
    };
  }

  return {};
}

// --- COMPILE GRAPH WORKFLOW ---

const workflow = new StateGraph(ResearchStateAnnotation)
  .addNode("resolveCompany", resolveCompanyNode)
  .addNode("collectEvidence", collectEvidenceNode)
  .addNode("normalizeEvidence", normalizeEvidenceNode)
  .addNode("assessCategories", assessCategoriesNode)
  .addNode("checkCompleteness", checkCompletenessNode)
  .addNode("interpretEvidence", interpretEvidenceNode)
  .addNode("validateVerdict", validateVerdictNode)
  .addNode("finalizeReport", finalizeReportNode)
  
  .addEdge(START, "resolveCompany")
  
  // Conditional Routing from resolveCompany
  .addConditionalEdges(
    "resolveCompany",
    (state) => (state.status === "unavailable" ? "finalizeReport" : "collectEvidence"),
    {
      finalizeReport: "finalizeReport",
      collectEvidence: "collectEvidence",
    }
  )
  
  // Conditional Routing from collectEvidence
  .addConditionalEdges(
    "collectEvidence",
    (state) => (state.status === "unavailable" ? "finalizeReport" : "normalizeEvidence"),
    {
      finalizeReport: "finalizeReport",
      normalizeEvidence: "normalizeEvidence",
    }
  )

  // Conditional Routing from normalizeEvidence
  .addConditionalEdges(
    "normalizeEvidence",
    (state) => (state.status === "unavailable" ? "finalizeReport" : "assessCategories"),
    {
      finalizeReport: "finalizeReport",
      assessCategories: "assessCategories",
    }
  )

  // Conditional Routing from assessCategories
  .addConditionalEdges(
    "assessCategories",
    (state) => (state.status === "unavailable" ? "finalizeReport" : "checkCompleteness"),
    {
      finalizeReport: "finalizeReport",
      checkCompleteness: "checkCompleteness",
    }
  )

  // Direct edge from checkCompleteness to interpretEvidence
  .addEdge("checkCompleteness", "interpretEvidence")

  // Conditional Routing from interpretEvidence
  .addConditionalEdges(
    "interpretEvidence",
    (state) => (state.status === "unavailable" ? "finalizeReport" : "validateVerdict"),
    {
      finalizeReport: "finalizeReport",
      validateVerdict: "validateVerdict",
    }
  )

  // Direct edges to finish
  .addEdge("validateVerdict", "finalizeReport")
  .addEdge("finalizeReport", END);

export const researchGraph = workflow.compile();
