import "server-only";
import Groq from "groq-sdk";
import { getGroqApiKey } from "@/src/lib/env";
import { EvidenceBundle } from "../research/buildEvidenceBundle";
import { CompanyMarketSnapshot, SignalsBreakdown } from "../../types/snapshot";
import { LLMAnalysisResult, analysisSchema } from "./gemini";

const getApiKey = () => {
  try {
    return getGroqApiKey();
  } catch {
    return null;
  }
};

export async function runGroqAnalysis(
  bundle: EvidenceBundle,
  snapshot: CompanyMarketSnapshot,
  signals: SignalsBreakdown,
  simulate?: "rate_limit" | "auth_error" | "timeout" | "schema_failure" | "provider_error"
): Promise<LLMAnalysisResult> {
  const startTime = Date.now();
  const modelName = "llama-3.3-70b-versatile";

  if (simulate) {
    const duration = Date.now() - startTime;
    return {
      provider: "groq",
      status: simulate,
      durationMs: duration,
      model: modelName,
      data: null,
      message: `Simulated Groq error: ${simulate}`,
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      provider: "groq",
      status: "auth_error",
      durationMs: Date.now() - startTime,
      model: modelName,
      data: null,
      message: "API key is not configured for Groq",
    };
  }

  try {
    const groq = new Groq({ apiKey });

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

    const systemPrompt = `You are a professional financial diagnostics AI. Your task is to analyze the company data bundle, local normalized snapshot, and mathematical signals, then return a structured JSON response matching the required schema.
CRITICAL RULES:
1. You must NOT invent missing values. If a value is absent from the evidence, state that it is unavailable. Never infer or fabricate a financial value.
2. Ground every interpretation in the provided evidence. Cite evidence IDs (e.g. "ev_1", "ev_2") in the citedEvidenceIds array.
3. Identify conflicts between providers (e.g. quote discrepancies or trend disagreements) and output them in the conflicts array.
4. List any key metrics or periods missing from the evidence in the evidenceGaps array.
5. Review the calculated mathematical signals (Price Momentum, Valuation, Financial Quality, News Sentiment, Data Confidence) and the final deterministic score. Synthesize these facts to output a qualitative "verdict" (strictly "INVEST", "WATCH", or "PASS") and a synthesized "finalScore" (0-100).

YOUR RESPONSE MUST BE VALID JSON CONFORMING EXACTLY TO THIS SCHEMA:
{
  "companySummary": "string",
  "financialInterpretation": "string",
  "marketInterpretation": "string",
  "newsInterpretation": "string",
  "webResearchInterpretation": "string",
  "strengths": ["string"],
  "concerns": ["string"],
  "conflicts": ["string"],
  "evidenceGaps": ["string"],
  "overallSummary": "string",
  "citedEvidenceIds": ["string"],
  "verdict": "INVEST" | "WATCH" | "PASS",
  "finalScore": number
}`;

    const userPrompt = `Here is the factual evidence bundle:
${JSON.stringify(sanitizedBundle, null, 2)}

Here is the normalized snapshot compiled:
${JSON.stringify(snapshot, null, 2)}

Here are the pre-calculated mathematical signals:
${JSON.stringify(signals, null, 2)}`;

    // Call Groq API
    const response = await groq.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const durationMs = Date.now() - startTime;
    const text = response.choices[0]?.message?.content;

    if (!text) {
      return {
        provider: "groq",
        status: "provider_error",
        durationMs,
        model: modelName,
        data: null,
        message: "Groq returned an empty text response",
      };
    }

    try {
      const rawJson = JSON.parse(text);
      const parsedData = analysisSchema.parse(rawJson);
      return {
        provider: "groq",
        status: "success",
        durationMs,
        model: modelName,
        data: parsedData,
      };
    } catch (parseErr: any) {
      return {
        provider: "groq",
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
      provider: "groq",
      status,
      durationMs,
      model: modelName,
      data: null,
      message: `Groq API Call failed: ${errMsg}`,
    };
  }
}
