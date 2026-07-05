import "server-only";
import { Evidence } from "../evidence/evidence.types";
import { llmRouter } from "../llm/llm-router";
import { GeminiProvider } from "../llm/providers/gemini.provider";
import { contradictionRepository } from "@/src/db/repositories/contradiction.repository";
import { reportRepository } from "@/src/db/repositories/report.repository";
import { generateId } from "@/src/lib/ids";
import { logger } from "@/src/lib/logger";
import { ResearchScores } from "../scoring/score.types";

const CONTRADICTION_DETECTION_SCHEMA = {
  type: "object",
  properties: {
    contradictions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          evidenceIdA: { type: "string" },
          evidenceIdB: { type: "string" },
          description: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          confidence: { type: "number" }
        },
        required: ["evidenceIdA", "evidenceIdB", "description", "severity", "confidence"]
      }
    }
  },
  required: ["contradictions"]
};

const REPORT_SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    thesis: { type: "string" },
    bullCase: {
      type: "array",
      items: { type: "string" }
    },
    bearCase: {
      type: "array",
      items: { type: "string" }
    },
    keyRisks: {
      type: "array",
      items: { type: "string" }
    },
    summary: { type: "string" }
  },
  required: ["thesis", "bullCase", "bearCase", "keyRisks", "summary"]
};

export async function runContradictionDetector(
  researchId: string,
  ticker: string,
  evidenceList: readonly Evidence[]
) {
  if (evidenceList.length < 2) {
    return [];
  }

  const prompt = `You are a Senior Investment Contradiction Detector. Review the following evidence items collected for ticker ${ticker}. Identify any statements, data points, or claims that contradict each other. A contradiction is when one piece of evidence asserts something that directly conflicts with or weakens another piece of evidence.

Evidence list:
${evidenceList
  .map(
    (e) =>
      `ID: ${e.id}
Category: ${e.category}
Source: ${e.sourceType}
Claim: ${e.claim}
Raw Value: ${e.rawValue}`
  )
  .join("\n\n")}

For each contradiction identified, return a JSON object with a "contradictions" key containing an array of objects. Each object in the array must have the following exact keys:
- "evidenceIdA": ID of the first conflicting evidence item
- "evidenceIdB": ID of the second conflicting evidence item
- "description": Clear description of the conflict/contradiction
- "severity": Severity rating, exactly one of "low", "medium", or "high"
- "confidence": Confidence score between 0.0 and 1.0
If no contradictions are found, return an empty array under the "contradictions" key.`;

  try {
    const response = await llmRouter.generateText(prompt, {
      responseSchema: CONTRADICTION_DETECTION_SCHEMA,
      temperature: 0.1,
    });

    const parsed = JSON.parse(response.text) as {
      contradictions?: {
        evidenceIdA: string;
        evidenceIdB: string;
        description: string;
        severity: "low" | "medium" | "high";
        confidence: number;
      }[];
    };

    const rawContradictions = parsed.contradictions || [];
    const validEvidenceIds = new Set(evidenceList.map((e) => e.id));

    // Filter to ensure referenced evidence IDs exist
    const contradictionsToInsert = rawContradictions
      .filter((c) => validEvidenceIds.has(c.evidenceIdA) && validEvidenceIds.has(c.evidenceIdB))
      .map((c) => ({
        id: generateId("ct"),
        researchId,
        evidenceIdA: c.evidenceIdA,
        evidenceIdB: c.evidenceIdB,
        description: c.description,
        severity: c.severity,
        confidence: String(Math.max(0, Math.min(1, c.confidence || 0.8))),
        createdAt: new Date(),
      }));

    if (contradictionsToInsert.length > 0) {
      return await contradictionRepository.insertContradictions(contradictionsToInsert);
    }
    return [];
  } catch (error) {
    logger.error("Error during contradiction detection", { researchId, error });
    return [];
  }
}

export async function synthesizeResearchReport(
  researchId: string,
  ticker: string,
  evidenceList: readonly Evidence[],
  scores: ResearchScores
) {
  const prompt = `You are a Lead Investment Analyst at a premium hedge fund. Synthesize a professional, institutional-grade research report for ticker ${ticker} based on the collected evidence and calculated category scores.

Evidence Pool:
${evidenceList
  .map(
    (e) =>
      `Category: ${e.category}
Source: ${e.sourceType}
Claim: ${e.claim}
Raw Value: ${e.rawValue}`
  )
  .join("\n\n")}

Calculated Scores & Recommendation:
- Business Score: ${scores.business}
- Financial Score: ${scores.financial}
- Valuation Score: ${scores.valuation}
- News Score: ${scores.news}
- Risk Score: ${scores.risk}
- Evidence Quality Score: ${scores.evidenceQuality}
- Contradiction Penalty: ${scores.contradictionPenalty}
- Final Score: ${scores.final}
- Decision: ${scores.decision}

Based on the evidence pool and scores, generate a JSON object with the following exact keys:
- "thesis": A concise, compelling investment thesis statement.
- "bullCase": A JSON array of strings containing a list of bull case elements (at least 3 key drivers / positives).
- "bearCase": A JSON array of strings containing a list of bear case elements (at least 3 key concerns / negatives).
- "keyRisks": A JSON array of strings containing a list of key risks (at least 3 risk factors).
- "summary": A comprehensive narrative summary (1-2 detailed paragraphs).`;

  let responseText = "";
  let success = false;

  // 1. Try Gemini 2.5 Pro first (Committee Model)
  try {
    logger.info("Committee: Attempting report synthesis with Gemini 2.5 Pro", { researchId });
    const proProvider = new GeminiProvider("gemini-2.5-pro");
    const response = await proProvider.generateText(prompt, {
      responseSchema: REPORT_SYNTHESIS_SCHEMA,
      temperature: 0.3,
    });
    responseText = response.text;
    success = true;
    logger.info("Committee: Report synthesis with Gemini 2.5 Pro succeeded", { researchId });
  } catch (err: any) {
    logger.warn("Committee: Gemini 2.5 Pro synthesis failed, trying fallback to Router", {
      researchId,
      error: err.message || String(err),
    });

    // 2. Fallback to router (Gemini 2.5 Flash / Groq)
    try {
      const response = await llmRouter.generateText(prompt, {
        responseSchema: REPORT_SYNTHESIS_SCHEMA,
        temperature: 0.3,
      });
      responseText = response.text;
      success = true;
      logger.info("Committee: Report synthesis with Router fallback succeeded", { researchId });
    } catch (fallbackErr: any) {
      logger.error("Committee: Fallback report synthesis also failed", {
        researchId,
        error: fallbackErr.message || String(fallbackErr),
      });
    }
  }

  if (success) {
    try {
      const parsed = JSON.parse(responseText) as {
        thesis: string;
        bullCase: string[];
        bearCase: string[];
        keyRisks: string[];
        summary: string;
      };

      const reportData = {
        id: generateId("rep"),
        researchId,
        thesis: parsed.thesis || "No thesis provided.",
        bullCase: JSON.stringify(parsed.bullCase || []),
        bearCase: JSON.stringify(parsed.bearCase || []),
        keyRisks: JSON.stringify(parsed.keyRisks || []),
        summary: parsed.summary || "No summary provided.",
        createdAt: new Date(),
      };

      await reportRepository.upsertReport(reportData);
      return { success: true, report: reportData };
    } catch (parseError: any) {
      logger.error("Committee: Failed to parse synthesized report JSON, using degraded report", {
        researchId,
        error: parseError.message || String(parseError),
      });
    }
  }

  // 3. Graceful degradation: write a degraded/fallback report row with empty values
  logger.warn("Committee: Writing empty fallback report to database", { researchId });
  const degradedReport = {
    id: generateId("rep"),
    researchId,
    thesis: "",
    bullCase: JSON.stringify([]),
    bearCase: JSON.stringify([]),
    keyRisks: JSON.stringify([]),
    summary: "",
    createdAt: new Date(),
  };

  await reportRepository.upsertReport(degradedReport);
  return { success: false, report: degradedReport };
}
