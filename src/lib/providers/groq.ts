import "server-only";
import Groq from "groq-sdk";
import { getGroqApiKey } from "@/src/lib/env";
import { EvidenceBundle } from "../research/buildEvidenceBundle";
import { CompanyMarketSnapshot, CategoryAssessments } from "../../types/snapshot";
import { z } from "zod";
import { compactEvidenceBundle } from "../research/compactPayload";

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
  verdict: z.enum(["INVEST", "WATCH", "PASS"]),
  finalScore: z.number().min(0).max(100),
});

export type AnalysisOutput = z.infer<typeof analysisSchema>;

export interface LLMAnalysisResult {
  provider: "groq" | "deterministic";
  status: "success" | "rate_limit" | "auth_error" | "timeout" | "network_error" | "schema_failure" | "provider_error" | "not_called";
  durationMs: number;
  model: string;
  data: AnalysisOutput | null;
  message?: string;
}

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
  categoryAssessments: CategoryAssessments,
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

    // Construct compacted evidence payload to limit context size
    const compactedBundle = compactEvidenceBundle(bundle);

    const systemPrompt = `You are a professional financial diagnostics AI. Your task is to analyze the compacted company data bundle, local normalized snapshot, and transparent category assessments, then return a structured JSON response matching the required schema.

CRITICAL ROLE AND RULES:
1. STRICTLY QUALITATIVE ANALYSIS: You must NEVER invent or extrapolate any numerical facts (such as stock prices, EPS, revenues, profits, P/E, or cash flow ratios).
2. ONLY interpret the news, events, and qualitative textual evidence provided to you.
3. If any financial or market value is absent from the evidence, state that it is unavailable. Never infer or fabricate a financial value.
4. Ground every interpretation in the provided evidence. Cite evidence IDs (e.g. "ev_1", "ev_2") in the citedEvidenceIds array.
5. Identify conflicts between providers (e.g. trend disagreements or news contradictions) and output them in the conflicts array.
6. List any key metrics or periods missing from the evidence in the evidenceGaps array.
7. Synthesize these facts to make an independent evidence-grounded judgment and output a qualitative "verdict" (strictly "INVEST", "WATCH", or "PASS") and a synthesized "finalScore" (0-100) representing your own professional analysis. Do not base your output on any external deterministic verdict.

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

    const userPrompt = `Here is the compacted factual evidence bundle:
${JSON.stringify(compactedBundle, null, 2)}

Here is the normalized snapshot compiled:
${JSON.stringify(snapshot, null, 2)}

Here are the pre-calculated Category Assessments:
${JSON.stringify(categoryAssessments, null, 2)}`;

    // Call Groq API
    const response = await groq.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
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
