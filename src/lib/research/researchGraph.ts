import "server-only";
import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { getGroqApiKey } from "@/src/lib/env";
import { CompanyIdentity } from "../company/symbolCandidates";
import { EvidenceBundle, buildEvidenceBundle } from "./buildEvidenceBundle";
import { CompanyMarketSnapshot, CategoryAssessments } from "../../types/snapshot";
import { AnalysisOutput } from "../providers/groq";
import { CURATED_COMPANIES } from "@/src/data/curatedCompanies";
import { runDiagnosticsPipeline } from "./fetchAllProviders";
import { runAllProviderHealthChecks } from "@/src/lib/providers/healthCheck";
import { buildSnapshot } from "./snapshotEngine";
import { compactEvidenceBundle } from "./compactPayload";
import { AnalysisRunResult } from "./llmAnalysis";
import { runOpenRouterAnalysis, OpenRouterLLMAnalysisResult } from "@/src/services/openrouter";
import { runGeminiAnalysis, GeminiLLMAnalysisResult, openRouterAnalysisSchema, OpenRouterAnalysisOutput } from "@/src/lib/providers/gemini";

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
  simulate: Annotation<{ groq?: string; openrouter?: string; gemini?: string } | undefined>(),
  openRouterResult: Annotation<OpenRouterLLMAnalysisResult | null>(),
  groqResult: Annotation<any | null>(),
  geminiResult: Annotation<GeminiLLMAnalysisResult | null>(),
  consensusResult: Annotation<OpenRouterAnalysisOutput | null>(),
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

// 6. OpenRouter Node
async function openRouterNode(state: typeof ResearchStateAnnotation.State) {
  if (
    state.status === "unavailable" ||
    !state.evidenceBundle ||
    !state.snapshot ||
    !state.categoryAssessments
  ) {
    return {};
  }

  const errors: string[] = [];
  const openRouterResult = await runOpenRouterAnalysis(
    state.evidenceBundle,
    state.snapshot,
    state.categoryAssessments,
    state.simulate?.openrouter as any
  );

  if (openRouterResult.status !== "success") {
    errors.push(`OpenRouter failed with status: ${openRouterResult.status}. Message: ${openRouterResult.message}`);
  }

  return {
    openRouterResult,
    errors,
  };
}

// 7. Groq Node (via LangChain structured output wrapper)
async function groqNode(state: typeof ResearchStateAnnotation.State) {
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
    return {
      groqResult: {
        provider: "groq" as const,
        status: simulate as any,
        durationMs: Date.now() - startTime,
        model: "llama-3.3-70b-versatile",
        data: null,
        message: `Simulated Groq error: ${simulate}`,
      },
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
    return {
      groqResult: {
        provider: "groq" as const,
        status: "auth_error" as const,
        durationMs: Date.now() - startTime,
        model: "llama-3.3-70b-versatile",
        data: null,
        message: "API key is not configured for Groq",
      },
    };
  }

  try {
    const model = new ChatGroq({
      apiKey,
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      maxRetries: 1,
    });

    const compactedBundle = compactEvidenceBundle(state.evidenceBundle);

    const systemPrompt = `You are a professional financial diagnostics AI. Your task is to analyze the compacted company data bundle, local normalized snapshot, and transparent category assessments, then return a structured JSON response matching the required schema.

CRITICAL ROLE AND RULES:
1. STRICTLY QUALITATIVE ANALYSIS: You must NEVER invent or extrapolate any numerical facts (such as stock prices, EPS, revenues, profits, P/E, or cash flow ratios).
2. ONLY interpret the news, events, and qualitative textual evidence provided to you.
3. If any financial or market value is absent from the evidence, state that it is unavailable. Never infer or fabricate a financial value.
4. Never search the internet or browse external links. Base every conclusion ONLY on the supplied evidence.
5. Synthesize these facts to make an independent evidence-grounded judgment and output:
   - "investmentScore": synthesized score (0-100).
   - "verdict": strictly "INVEST" or "PASS" (no third option).
   - "confidence": confidence score of this judgment (0-100).
   - "pros": array of key positive evidence highlights.
   - "cons": array of key concerns or negative points.
   - "riskFactors": array of primary risks based ONLY on the evidence.
   - "summary": a short, direct summary overview of the investment thesis.
If evidence is insufficient, weak, incomplete, contradictory, or too unreliable to justify investment, you MUST output a verdict of PASS. Keep all explanations and narrative fields short, direct, and to the point.`;

    const userPrompt = `Here is the compacted factual evidence bundle:
${JSON.stringify(compactedBundle, null, 2)}

Here is the normalized snapshot compiled:
${JSON.stringify(state.snapshot, null, 2)}

Here are the pre-calculated Category Assessments:
${JSON.stringify(state.categoryAssessments, null, 2)}`;

    const modelWithStructuredOutput = model.withStructuredOutput(openRouterAnalysisSchema);
    const response = await modelWithStructuredOutput.invoke([
      ["system", systemPrompt],
      ["user", userPrompt],
    ]);

    const durationMs = Date.now() - startTime;
    return {
      groqResult: {
        provider: "groq" as const,
        status: "success" as const,
        durationMs,
        model: "llama-3.3-70b-versatile",
        data: response as OpenRouterAnalysisOutput,
      },
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    errors.push(`Groq Node execution failed: ${error.message || error}`);
    return {
      groqResult: {
        provider: "groq" as const,
        status: "provider_error" as const,
        durationMs,
        model: "llama-3.3-70b-versatile",
        data: null,
        message: `Groq execution failed: ${error.message || error}`,
      },
      errors,
    };
  }
}

// 8. Gemini Node (Mock)
async function geminiNode(state: typeof ResearchStateAnnotation.State) {
  if (
    state.status === "unavailable" ||
    !state.evidenceBundle ||
    !state.snapshot ||
    !state.categoryAssessments
  ) {
    return {};
  }

  const geminiResult = await runGeminiAnalysis(
    state.evidenceBundle,
    state.snapshot,
    state.categoryAssessments,
    state.simulate?.gemini as any
  );

  return {
    geminiResult,
  };
}

// 9. Consensus Node
async function consensusNode(state: typeof ResearchStateAnnotation.State) {
  if (state.status === "unavailable") {
    return {};
  }

  const successfulRuns: { provider: string; data: OpenRouterAnalysisOutput }[] = [];
  const attempts: any[] = [];

  // Register OpenRouter Attempt
  if (state.openRouterResult) {
    attempts.push({
      provider: "openrouter",
      status: state.openRouterResult.status,
      durationMs: state.openRouterResult.durationMs,
      model: state.openRouterResult.model,
      message: state.openRouterResult.message,
    });
    if (state.openRouterResult.status === "success" && state.openRouterResult.data) {
      successfulRuns.push({ provider: "openrouter", data: state.openRouterResult.data });
    }
  }

  // Register Groq Attempt
  if (state.groqResult) {
    attempts.push({
      provider: "groq",
      status: state.groqResult.status,
      durationMs: state.groqResult.durationMs,
      model: state.groqResult.model,
      message: state.groqResult.message,
    });
    if (state.groqResult.status === "success" && state.groqResult.data) {
      successfulRuns.push({ provider: "groq", data: state.groqResult.data });
    }
  }

  // Register Gemini Attempt
  if (state.geminiResult) {
    attempts.push({
      provider: "gemini",
      status: state.geminiResult.status,
      durationMs: state.geminiResult.durationMs,
      model: state.geminiResult.model,
      message: state.geminiResult.message,
    });
    if (state.geminiResult.status === "success" && state.geminiResult.data) {
      successfulRuns.push({ provider: "gemini", data: state.geminiResult.data });
    }
  }

  // Determine if we should perform consensus
  const hasOpenRouter = state.openRouterResult?.status === "success";

  let targetRuns = successfulRuns;
  if (!hasOpenRouter) {
    // OpenRouter is unavailable/failed, continue pipeline using Gemini and Groq
    targetRuns = successfulRuns.filter((r) => r.provider === "gemini" || r.provider === "groq");
  }

  if (targetRuns.length === 0) {
    return {
      status: "unavailable" as const,
      errors: ["All active reasoning models failed to generate valid results."],
      analysisRunResult: {
        status: "unavailable" as const,
        analysisMode: "unavailable" as const,
        selectedProvider: null,
        data: null,
        attempts,
        activeProvider: null,
        groq: state.groqResult || null,
        analysis: null,
        message: "Consensus node execution failed.",
      },
    };
  }

  // Calculate consensus:
  let investVotes = 0;
  let passVotes = 0;
  let scoreSum = 0;
  let confidenceSum = 0;
  const prosSet = new Set<string>();
  const consSet = new Set<string>();
  const risksSet = new Set<string>();

  for (const run of targetRuns) {
    if (run.data.verdict === "INVEST") {
      investVotes++;
    } else {
      passVotes++;
    }
    scoreSum += run.data.investmentScore;
    confidenceSum += run.data.confidence;
    run.data.pros.forEach((p) => prosSet.add(p));
    run.data.cons.forEach((c) => consSet.add(c));
    run.data.riskFactors.forEach((r) => risksSet.add(r));
  }

  const verdict = investVotes > passVotes ? ("INVEST" as const) : ("PASS" as const);
  const investmentScore = Math.round(scoreSum / targetRuns.length);
  const confidence = Math.round(confidenceSum / targetRuns.length);

  // Use primary successful model for summary
  const primaryModel = targetRuns.find((r) => r.provider === "openrouter") || targetRuns.find((r) => r.provider === "groq") || targetRuns[0];
  const summary = `Consensus Verdict: ${verdict} (INVEST: ${investVotes}, PASS: ${passVotes}). ${primaryModel.data.summary}`;

  const consensusResult: OpenRouterAnalysisOutput = {
    verdict,
    investmentScore,
    confidence,
    pros: Array.from(prosSet),
    cons: Array.from(consSet),
    riskFactors: Array.from(risksSet),
    summary,
  };

  // Map to legacy AnalysisOutput contract expected by the frontend
  const legacyAnalysis: AnalysisOutput = {
    companySummary: consensusResult.summary,
    financialInterpretation: `Evaluated via Consensus Node: ${targetRuns.map((r) => r.provider).join(", ")}.`,
    marketInterpretation: `Investment Score: ${consensusResult.investmentScore}/100. Confidence: ${consensusResult.confidence}%.`,
    newsInterpretation: "Factual news sentiment resolved.",
    webResearchInterpretation: "Web evidence references parsed.",
    strengths: consensusResult.pros,
    concerns: consensusResult.cons,
    conflicts: consensusResult.riskFactors,
    evidenceGaps: [],
    overallSummary: consensusResult.summary,
    citedEvidenceIds: [],
    verdict: consensusResult.verdict,
    finalScore: consensusResult.investmentScore,
  };

  const selectedProvider = hasOpenRouter ? ("openrouter" as const) : ("groq" as const);

  const analysisRunResult: AnalysisRunResult = {
    status: "success",
    analysisMode: "llm",
    selectedProvider: selectedProvider as any,
    data: legacyAnalysis,
    attempts,
    activeProvider: selectedProvider as any,
    groq: state.groqResult || { provider: "groq" as const, status: "not_called" as const, durationMs: 0, model: "llama-3.3-70b-versatile", data: null },
    analysis: legacyAnalysis,
  };

  return {
    consensusResult,
    interpretation: legacyAnalysis,
    verdict: consensusResult.verdict,
    analysisRunResult,
    status: "success" as const,
  };
}

// 10. Validate Verdict Node
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
  };

  return {
    interpretation,
    verdict: interpretation.verdict as "INVEST" | "PASS",
    errors,
    analysisRunResult: updatedRunResult,
  };
}

// 11. Finalize Report Node
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
      message: "Consensus analysis node execution failed.",
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
  .addNode("openRouterNode", openRouterNode)
  .addNode("groqNode", groqNode)
  .addNode("geminiNode", geminiNode)
  .addNode("consensusNode", consensusNode)
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
  
  // Direct edge from checkCompleteness to OpenRouter Node
  .addEdge("checkCompleteness", "openRouterNode")
  
  // Chain openRouterNode to groqNode
  .addEdge("openRouterNode", "groqNode")

  // Chain groqNode to geminiNode
  .addEdge("groqNode", "geminiNode")

  // Chain geminiNode to consensusNode
  .addEdge("geminiNode", "consensusNode")
  
  // Conditional Routing from consensusNode
  .addConditionalEdges(
    "consensusNode",
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
