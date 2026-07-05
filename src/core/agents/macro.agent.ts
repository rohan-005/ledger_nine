import "server-only";
import { runAgent } from "./shared/run-agent";
import { tavilyClient } from "@/src/integrations/tavily/tavily.client";
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

export async function runMacroAgent(researchId: string, ticker: string) {
  return runAgent(researchId, "macro", async (agentRunId) => {
    logger.info("Macro Agent: Initiating Tavily web search", { ticker });
    let searchResult: unknown = null;

    try {
      const query = `${ticker.toUpperCase()} stock latest market news analysis macro trends industry outlook`;
      searchResult = await tavilyClient.search(query, ticker, "basic");
    } catch (e) {
      logger.warn("Macro Agent: Tavily search query failed, continuing with empty", { ticker, error: e });
    }

    const rawData = {
      searchResult,
    };

    const prompt = `You are a macroeconomics and financial news specialist agent analyzing ${ticker.toUpperCase()}.
Analyze the following search results about the company, its industry, competitor dynamics, and broader macroeconomic factors.
Identify key news events, macro opportunities, competitive advantages, or industry-wide risks.
Target categories should be primarily 'news' or 'risk', but can also be 'business'.

Raw Data:
${JSON.stringify(rawData, null, 2)}

For each piece of evidence extracted, provide:
1. claim: Specific factual assertion or news finding.
2. category: Must be one of: 'business', 'financial', 'valuation', 'news', 'risk'.
3. rawValue: The exact supporting snippet or news quote.
4. normalizedValue: A numeric value of the metric if applicable (optional).
5. confidence: Numeric score from 0.0 to 1.0.
6. sourceQuality: Numeric score from 0.0 to 1.0.`;

    const response = await llmRouter.generateText(prompt, {
      agentRunId,
      responseSchema: EVIDENCE_SCHEMA,
      temperature: 0.2,
    });

    let extracted: { evidence?: { claim: string; category: string; rawValue: string; normalizedValue?: number; confidence: number; sourceQuality: number }[] };
    try {
      extracted = JSON.parse(response.text);
    } catch (err) {
      logger.error("Failed to parse Macro agent LLM output", { text: response.text });
      throw new Error("Macro Agent LLM output was not valid JSON");
    }

    const rawEvidenceList = extracted.evidence || [];
    const evidenceToInsert = rawEvidenceList.map((item) => ({
      id: generateId("run").replace("run_", "ev_"),
      researchId,
      claim: item.claim,
      category: item.category || "news",
      sourceType: "tavily" as const,
      rawValue: item.rawValue,
      normalizedValue: item.normalizedValue !== undefined && item.normalizedValue !== null && !isNaN(Number(item.normalizedValue)) && typeof item.normalizedValue !== "object" ? String(item.normalizedValue) : null,
      confidence: String(item.confidence || 0.75),
      sourceQuality: String(item.sourceQuality || 0.8),
      agentId: "macro",
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
