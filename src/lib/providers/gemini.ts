import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "@/src/lib/env";
import { EvidenceBundle } from "../research/buildEvidenceBundle";
import { z } from "zod";

export const analysisSchema = z.object({
  companySummary: z.string(),
  financialInterpretation: z.string(),
  marketInterpretation: z.string(),
  newsInterpretation: z.string(),
  webResearchInterpretation: z.string(),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  conflicts: z.array(z.string()),
  evidenceGaps: z.array(z.string()),
  overallSummary: z.string(),
  citedEvidenceIds: z.array(z.string()),
});

export type AnalysisOutput = z.infer<typeof analysisSchema>;

export interface LLMAnalysisResult {
  provider: "gemini" | "groq" | "deterministic";
  status: "success" | "rate_limit" | "auth_error" | "timeout" | "network_error" | "schema_failure" | "provider_error" | "not_called";
  durationMs: number;
  model: string;
  data: AnalysisOutput | null;
  message?: string;
}

const getApiKey = () => {
  try {
    return getGeminiApiKey();
  } catch {
    return null;
  }
};

export async function runGeminiAnalysis(
  bundle: EvidenceBundle,
  simulate?: "rate_limit" | "auth_error" | "timeout" | "schema_failure" | "provider_error"
): Promise<LLMAnalysisResult> {
  const startTime = Date.now();
  const modelName = "gemini-2.5-flash";

  if (simulate) {
    const duration = Date.now() - startTime;
    return {
      provider: "gemini",
      status: simulate,
      durationMs: duration,
      model: modelName,
      data: null,
      message: `Simulated Gemini error: ${simulate}`,
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      provider: "gemini",
      status: "auth_error",
      durationMs: Date.now() - startTime,
      model: modelName,
      data: null,
      message: "API key is not configured for Gemini",
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Construct sanitized prompt and bundle payload
    const sanitizedBundle = {
      company: bundle.company,
      companyProfiles: bundle.companyProfiles,
      quotes: bundle.quotes,
      financialStatements: bundle.financialStatements,
      metrics: bundle.metrics,
      ratios: bundle.ratios,
      historicalPrices: bundle.historicalPrices,
      news: bundle.news,
      webResearch: bundle.webResearch,
      providerFailures: bundle.providerFailures,
    };

    const systemPrompt = `You are a professional financial diagnostics AI. Your task is to analyze the company data bundle and return a structured JSON response matching the required schema.
CRITICAL RULES:
1. You must NOT invent missing values. If a value is absent from the evidence, state that it is unavailable. Never infer or fabricate a financial value.
2. Ground every interpretation in the provided evidence. Cite evidence IDs (e.g. "ev_1", "ev_2") in the citedEvidenceIds array.
3. Identify conflicts between providers (e.g. quote discrepancies or trend disagreements) and output them in the conflicts array.
4. List any key metrics or periods missing from the evidence in the evidenceGaps array.`;

    const userPrompt = `Here is the factual evidence bundle:
${JSON.stringify(sanitizedBundle, null, 2)}`;

    // Call Gemini API
    const response = await ai.models.generateContent({
      model: modelName,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const durationMs = Date.now() - startTime;
    const text = response.text;

    if (!text) {
      return {
        provider: "gemini",
        status: "provider_error",
        durationMs,
        model: modelName,
        data: null,
        message: "Gemini returned an empty text response",
      };
    }

    try {
      const rawJson = JSON.parse(text);
      const parsedData = analysisSchema.parse(rawJson);
      return {
        provider: "gemini",
        status: "success",
        durationMs,
        model: modelName,
        data: parsedData,
      };
    } catch (parseErr: any) {
      return {
        provider: "gemini",
        status: "schema_failure",
        durationMs,
        model: modelName,
        data: null,
        message: `Schema validation failed: ${parseErr.message || parseErr}`,
      };
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errMsg = err.message || "";
    let status: LLMAnalysisResult["status"] = "provider_error";

    if (errMsg.includes("rate limit") || errMsg.includes("429") || errMsg.includes("quota")) {
      status = "rate_limit";
    } else if (errMsg.includes("API key") || errMsg.includes("auth") || errMsg.includes("401") || errMsg.includes("403")) {
      status = "auth_error";
    } else if (errMsg.includes("timeout") || errMsg.includes("deadline")) {
      status = "timeout";
    }

    return {
      provider: "gemini",
      status,
      durationMs,
      model: modelName,
      data: null,
      message: `Gemini API Call failed: ${errMsg}`,
    };
  }
}
