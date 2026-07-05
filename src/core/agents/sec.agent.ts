import "server-only";
import { runAgent } from "./shared/run-agent";
import { secClient } from "@/src/integrations/sec/sec.client";
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

export async function runSecAgent(researchId: string, ticker: string, providedCik?: string) {
  return runAgent(researchId, "sec", async (agentRunId) => {
    logger.info("SEC Agent: Resolving CIK", { ticker, providedCik });
    let cik = providedCik;

    if (!cik) {
      try {
        const profile = await fmpClient.getCompanyProfile(ticker);
        if (profile && profile.cik) {
          cik = String(profile.cik);
          logger.info("SEC Agent: Resolved CIK from FMP profile", { ticker, cik });
        }
      } catch (err) {
        logger.warn("SEC Agent: CIK resolution from FMP profile failed", { ticker, err });
      }
    }

    if (!cik) {
      throw new Error(`Could not resolve CIK for ticker ${ticker}. Please provide it explicitly.`);
    }

    logger.info("SEC Agent: Fetching SEC filings and facts", { cik });
    let submissions: unknown = null;
    let companyFacts: unknown = null;

    try {
      submissions = await secClient.getSubmissions(cik);
    } catch (e) {
      logger.warn("SEC submissions fetch failed, continuing with empty", { cik, error: e });
    }

    try {
      companyFacts = await secClient.getCompanyFacts(cik);
    } catch (e) {
      logger.warn("SEC company facts fetch failed, continuing with empty", { cik, error: e });
    }

    const rawData = {
      submissions,
      companyFacts,
    };

    const prompt = `You are an SEC filings specialist agent analyzing ${ticker.toUpperCase()} (CIK: ${cik}).
Analyze the following regulatory filings metadata and company facts from the SEC EDGAR system.
Identify any risk factors, recent filing history, regulatory flags, or significant financial facts.
Target categories should be primarily 'risk' or 'financial', but can also be 'business' or 'valuation'.

Raw Data (truncated for brevity if extremely large):
${JSON.stringify(rawData, null, 2).slice(0, 30000)}

For each piece of evidence extracted, provide:
1. claim: Specific factual assertion or regulatory finding.
2. category: Must be one of: 'business', 'financial', 'valuation', 'news', 'risk'.
3. rawValue: The exact metric value or supporting snippet from the data.
4. normalizedValue: A numeric value of the metric if applicable.
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
      logger.error("Failed to parse SEC agent LLM output", { text: response.text });
      throw new Error("SEC Agent LLM output was not valid JSON");
    }

    const rawEvidenceList = extracted.evidence || [];
    const evidenceToInsert = rawEvidenceList.map((item) => ({
      id: generateId("run").replace("run_", "ev_"),
      researchId,
      claim: item.claim,
      category: item.category || "risk",
      sourceType: "sec" as const,
      rawValue: item.rawValue,
      normalizedValue: item.normalizedValue !== undefined && item.normalizedValue !== null && !isNaN(Number(item.normalizedValue)) && typeof item.normalizedValue !== "object" ? String(item.normalizedValue) : null,
      confidence: String(item.confidence || 0.85),
      sourceQuality: String(item.sourceQuality || 0.95),
      agentId: "sec",
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
