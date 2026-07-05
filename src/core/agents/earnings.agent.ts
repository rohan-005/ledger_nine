import "server-only";
import { runAgent } from "./shared/run-agent";
import { alphaVantageClient } from "@/src/integrations/alpha-vantage/alpha-vantage.client";
import { llmRouter } from "@/src/core/llm/llm-router";
import { evidenceRepository } from "@/src/db/repositories/evidence.repository";
import { generateId } from "@/src/lib/ids";
import { logger } from "@/src/lib/logger";

const EVIDENCE_SCHEMA = {
  type: "OBJECT",
  properties: {
    evidence: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          claim: { type: "STRING" },
          category: { type: "STRING" },
          rawValue: { type: "STRING" },
          normalizedValue: { type: "NUMBER" },
          confidence: { type: "NUMBER" },
          sourceQuality: { type: "NUMBER" },
        },
        required: ["claim", "category", "rawValue", "confidence", "sourceQuality"],
      },
    },
  },
  required: ["evidence"],
};

export async function runEarningsAgent(researchId: string, ticker: string) {
  return runAgent(researchId, "earnings", async (agentRunId) => {
    logger.info("Earnings Agent: Fetching Alpha Vantage earnings reports", { ticker });
    let earningsData: unknown = null;

    try {
      earningsData = await alphaVantageClient.getEarnings(ticker);
    } catch (e) {
      logger.warn("Earnings Agent: Alpha Vantage earnings fetch failed, continuing with empty", { ticker, error: e });
    }

    const rawData = {
      earningsData,
    };

    const prompt = `You are an earnings and performance specialist agent analyzing ${ticker.toUpperCase()}.
Analyze the following earnings history data (annual and quarterly reports, EPS surprises, net income progression).
Identify key trends in earnings beats/misses, seasonal profitability factors, and earnings surprises.
Target categories should be primarily 'financial' or 'risk', but can also be 'business'.

Raw Data (truncated if extremely large):
${JSON.stringify(rawData, null, 2).slice(0, 30000)}

For each piece of evidence extracted, provide:
1. claim: Specific factual assertion about earnings or EPS behavior.
2. category: Must be one of: 'business', 'financial', 'valuation', 'news', 'risk'.
3. rawValue: The exact supporting metric or EPS values.
4. normalizedValue: A numeric value of the metric if applicable (optional).
5. confidence: Numeric score from 0.0 to 1.0.
6. sourceQuality: Numeric score from 0.0 to 1.0.`;

    const response = await llmRouter.generateText(prompt, {
      agentRunId,
      responseSchema: EVIDENCE_SCHEMA,
      temperature: 0.1,
    });

    let extracted: { evidence?: { claim: string; category: string; rawValue: string; normalizedValue?: number; confidence: number; sourceQuality: number }[] };
    try {
      extracted = JSON.parse(response.text);
    } catch (err) {
      logger.error("Failed to parse Earnings agent LLM output", { text: response.text });
      throw new Error("Earnings Agent LLM output was not valid JSON");
    }

    const rawEvidenceList = extracted.evidence || [];
    const evidenceToInsert = rawEvidenceList.map((item) => ({
      id: generateId("run").replace("run_", "ev_"),
      researchId,
      claim: item.claim,
      category: item.category || "financial",
      sourceType: "alpha_vantage" as const,
      rawValue: item.rawValue,
      normalizedValue: item.normalizedValue !== undefined && item.normalizedValue !== null ? String(item.normalizedValue) : null,
      confidence: String(item.confidence || 0.8),
      sourceQuality: String(item.sourceQuality || 0.85),
      agentId: "earnings",
      observedAt: new Date(),
    }));

    let inserted: any[] = [];
    if (evidenceToInsert.length > 0) {
      inserted = await evidenceRepository.insertManyEvidence(evidenceToInsert as any);
    }

    return {
      data: inserted,
      provider: response.provider,
      model: response.model,
    };
  });
}
