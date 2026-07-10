import "server-only";
import { ChatOpenAI } from "@langchain/openai";
import { getOpenRouterApiKey, getOpenRouterModel } from "@/src/lib/env";
import { EvidenceBundle } from "@/src/lib/research/buildEvidenceBundle";
import { CompanyMarketSnapshot, CategoryAssessments } from "@/src/types/snapshot";
import { openRouterAnalysisSchema, OpenRouterAnalysisOutput } from "@/src/lib/providers/gemini";
import { compactEvidenceBundle } from "@/src/lib/research/compactPayload";

export interface OpenRouterLLMAnalysisResult {
  provider: "openrouter";
  status: "success" | "rate_limit" | "auth_error" | "timeout" | "network_error" | "schema_failure" | "provider_error" | "not_called";
  durationMs: number;
  model: string;
  data: OpenRouterAnalysisOutput | null;
  message?: string;
}

const getApiKey = () => {
  try {
    return getOpenRouterApiKey();
  } catch {
    return null;
  }
};

export async function runOpenRouterAnalysis(
  bundle: EvidenceBundle,
  snapshot: CompanyMarketSnapshot,
  categoryAssessments: CategoryAssessments,
  simulate?: "rate_limit" | "auth_error" | "timeout" | "schema_failure" | "provider_error"
): Promise<OpenRouterLLMAnalysisResult> {
  const startTime = Date.now();
  const modelName = getOpenRouterModel();

  if (simulate) {
    return {
      provider: "openrouter",
      status: simulate,
      durationMs: Date.now() - startTime,
      model: modelName,
      data: null,
      message: `Simulated OpenRouter error: ${simulate}`,
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      provider: "openrouter",
      status: "auth_error",
      durationMs: Date.now() - startTime,
      model: modelName,
      data: null,
      message: "API key is not configured for OpenRouter",
    };
  }

  // Define retries and delay
  const maxRetries = 2;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      // Initialize LangChain ChatOpenAI for OpenRouter
      const model = new ChatOpenAI({
        apiKey,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
        },
        modelName,
        temperature: 0.3,
        maxRetries: 1, // LangChain internal retry count
        timeout: 10000, // 10 seconds timeout
      });

      const compactedBundle = compactEvidenceBundle(bundle);

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
${JSON.stringify(snapshot, null, 2)}

Here are the pre-calculated Category Assessments:
${JSON.stringify(categoryAssessments, null, 2)}`;

      const modelWithStructuredOutput = model.withStructuredOutput(openRouterAnalysisSchema);
      const response = await modelWithStructuredOutput.invoke([
        ["system", systemPrompt],
        ["user", userPrompt],
      ]);

      const durationMs = Date.now() - startTime;
      return {
        provider: "openrouter",
        status: "success",
        durationMs,
        model: modelName,
        data: response as OpenRouterAnalysisOutput,
      };
    } catch (err: any) {
      attempt++;
      const durationMs = Date.now() - startTime;
      const errMsg = err.message || "";

      let status: OpenRouterLLMAnalysisResult["status"] = "provider_error";
      const errMsgLower = errMsg.toLowerCase();
      if (errMsgLower.includes("rate limit") || errMsgLower.includes("429") || errMsgLower.includes("quota")) {
        status = "rate_limit";
      } else if (errMsgLower.includes("api key") || errMsgLower.includes("auth") || errMsgLower.includes("401") || errMsgLower.includes("403")) {
        status = "auth_error";
      } else if (errMsgLower.includes("timeout") || errMsgLower.includes("deadline") || errMsgLower.includes("abort")) {
        status = "timeout";
      }

      if (attempt > maxRetries) {
        return {
          provider: "openrouter",
          status,
          durationMs,
          model: modelName,
          data: null,
          message: `OpenRouter API call failed after ${maxRetries + 1} attempts: ${errMsg}`,
        };
      }

      // Exponential backoff delay: 500ms * (2 ^ attempt)
      const delay = 500 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    provider: "openrouter",
    status: "provider_error",
    durationMs: Date.now() - startTime,
    model: modelName,
    data: null,
    message: "Unknown error during OpenRouter execution",
  };
}
