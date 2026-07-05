import "server-only";
import { runAgent } from "./shared/run-agent";
import { fmpClient } from "@/src/integrations/fmp/fmp.client";
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

export async function runFinancialAgent(researchId: string, ticker: string) {
  return runAgent(researchId, "financial", async (agentRunId) => {
    logger.info("Financial Agent: Fetching FMP corporate data", { ticker });
    let profile: Record<string, unknown> = {};
    let quote: Record<string, unknown> = {};
    let income: unknown[] = [];
    let balance: unknown[] = [];
    let cashFlow: unknown[] = [];
    let metrics: unknown[] = [];
    let ratios: unknown[] = [];

    try {
      profile = await fmpClient.getCompanyProfile(ticker);
    } catch (e) {
      logger.warn("FMP company profile fetch failed, continuing with empty", { ticker, error: e });
    }

    try {
      quote = await fmpClient.getQuote(ticker);
    } catch (e) {
      logger.warn("FMP quote fetch failed, continuing with empty", { ticker, error: e });
    }

    try {
      income = await fmpClient.getIncomeStatements(ticker);
    } catch (e) {
      logger.warn("FMP income statement fetch failed, continuing with empty", { ticker, error: e });
    }

    try {
      balance = await fmpClient.getBalanceSheets(ticker);
    } catch (e) {
      logger.warn("FMP balance sheet fetch failed, continuing with empty", { ticker, error: e });
    }

    try {
      cashFlow = await fmpClient.getCashFlowStatements(ticker);
    } catch (e) {
      logger.warn("FMP cash flow statement fetch failed, continuing with empty", { ticker, error: e });
    }

    try {
      metrics = await fmpClient.getKeyMetrics(ticker);
    } catch (e) {
      logger.warn("FMP key metrics fetch failed, continuing with empty", { ticker, error: e });
    }

    try {
      ratios = await fmpClient.getFinancialRatios(ticker);
    } catch (e) {
      logger.warn("FMP financial ratios fetch failed, continuing with empty", { ticker, error: e });
    }

    const rawData = {
      profile,
      quote,
      income,
      balance,
      cashFlow,
      metrics,
      ratios,
    };

    const prompt = `You are a financial specialist agent analyzing ${ticker.toUpperCase()}.
Analyze the following financial data and extract key evidence for investment decision making.
Target categories should be primarily 'financial' or 'valuation', but can also be 'business' or 'risk'.

Raw Data:
${JSON.stringify(rawData, null, 2)}

For each piece of evidence extracted, provide:
1. claim: Specific factual assertion.
2. category: Must be one of: 'business', 'financial', 'valuation', 'news', 'risk'.
3. rawValue: The exact metric value or supporting snippet from the data.
4. normalizedValue: A numeric value of the metric if applicable (e.g. debt-to-equity ratio as 1.5, revenue growth rate as 0.12, etc.).
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
      logger.error("Failed to parse financial agent LLM output", { text: response.text });
      throw new Error("Financial Agent LLM output was not valid JSON");
    }

    const rawEvidenceList = extracted.evidence || [];
    const evidenceToInsert = rawEvidenceList.map((item) => ({
      id: generateId("run").replace("run_", "ev_"),
      researchId,
      claim: item.claim,
      category: item.category || "financial",
      sourceType: "fmp" as const,
      rawValue: item.rawValue,
      normalizedValue: item.normalizedValue !== undefined && item.normalizedValue !== null ? String(item.normalizedValue) : null,
      confidence: String(item.confidence || 0.8),
      sourceQuality: String(item.sourceQuality || 0.9),
      agentId: "financial",
      observedAt: new Date(),
    }));

    let inserted: any[] = [];
    if (evidenceToInsert.length > 0) {
      // Need to cast to match table insertions
      inserted = await evidenceRepository.insertManyEvidence(evidenceToInsert as any);
    }

    return {
      data: inserted,
      provider: response.provider,
      model: response.model,
    };
  });
}
