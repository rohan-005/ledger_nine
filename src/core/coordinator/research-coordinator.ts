import "server-only";
import { generateId } from "@/src/lib/ids";
import { logger } from "@/src/lib/logger";
import { researchRepository } from "@/src/db/repositories/research.repository";
import { scoreRepository } from "@/src/db/repositories/score.repository";
import { orchestrateSpecialists } from "../agents/orchestrator";
import { runContradictionDetector, synthesizeResearchReport } from "../consensus/consensus";
import { calculateScores } from "../scoring/scoring-engine";
import { fmpClient } from "@/src/integrations/fmp/fmp.client";
import { parseAssetProfile } from "@/src/lib/research/asset-identity";
import { checkSufficiency } from "@/src/lib/research/sufficiency";
import { sanitizeErrorMessage } from "@/src/lib/errors-sanitizer";
import { agentRunRepository } from "@/src/db/repositories/agent-run.repository";
import { reportRepository } from "@/src/db/repositories/report.repository";

export const researchCoordinator = {
  /**
   * Starts a research run, launches the process asynchronously in the background,
   * and returns the research run ID immediately.
   */
  async startResearch(
    ticker: string,
    investmentHorizon: string,
    riskTolerance: "low" | "moderate" | "high"
  ): Promise<string> {
    const researchId = generateId("run");
    const cleanTicker = ticker.toUpperCase().trim();

    logger.info("Coordinator: Starting new research run", { researchId, ticker: cleanTicker });

    // Initialize in DB
    await researchRepository.createRun({
      id: researchId,
      ticker: cleanTicker,
      companyName: cleanTicker, // Default to ticker, will update once profile is fetched
      investmentHorizon,
      riskTolerance,
      status: "queued",
    });

    // Launch background execution without awaiting
    this.executeResearch(researchId, cleanTicker, investmentHorizon, riskTolerance).catch((err) => {
      logger.error("Coordinator: Background research run failed", { researchId, error: err });
    });

    return researchId;
  },

  /**
   * Synchronously executes the full research pipeline for a given run ID.
   */
  async executeResearch(
    researchId: string,
    ticker: string,
    investmentHorizon: string,
    riskTolerance: "low" | "moderate" | "high"
  ) {
    logger.info("Coordinator: Executing pipeline", { researchId, ticker });
    await researchRepository.updateStatus(researchId, "running");

    try {
      // 1. Fetch Company Name & Resolve Asset Identity
      let profilePayload: Record<string, any> | null = null;
      try {
        profilePayload = await fmpClient.getCompanyProfile(ticker);
      } catch (err) {
        logger.warn("Coordinator: Failed to retrieve company profile", { ticker, error: err });
      }

      const identity = parseAssetProfile(ticker, profilePayload);

      // Asset Resolution check: exit early if ticker is unresolved
      if (!identity.resolved) {
        logger.info("Coordinator: Asset unresolved. Exiting early.", { researchId, ticker });
        
        // Write empty report row so DB queries find it
        await reportRepository.upsertReport({
          id: generateId("rep"),
          researchId,
          thesis: "",
          bullCase: JSON.stringify([]),
          bearCase: JSON.stringify([]),
          keyRisks: JSON.stringify([]),
          summary: "",
          createdAt: new Date(),
        });

        await researchRepository.updateCurrentNode(researchId, "completed");
        await researchRepository.markCompleted(
          researchId,
          ticker,
          "asset_unresolved",
          ["UNRESOLVED_TICKER"],
          []
        );
        return;
      }

      const companyName = identity.companyName || ticker;

      // 2. Run Specialist Agents in parallel
      await researchRepository.updateCurrentNode(researchId, "specialists");
      const evidenceList = await orchestrateSpecialists(researchId, ticker, identity);

      // 3. Detect Contradictions
      await researchRepository.updateCurrentNode(researchId, "contradictions");
      const contradictionsList = await runContradictionDetector(researchId, ticker, evidenceList);

      // Grounding Audit: Verify that all contradictions reference valid evidence IDs
      const validEvidenceIds = new Set(evidenceList.map((e) => e.id));
      const ungroundedContradictions = contradictionsList.filter(
        (c) => !validEvidenceIds.has(c.evidenceIdA) || !validEvidenceIds.has(c.evidenceIdB)
      );
      if (ungroundedContradictions.length > 0) {
        logger.error("Grounding Audit: Detected ungrounded contradictions referencing non-existent evidence!", {
          researchId,
          ticker,
          count: ungroundedContradictions.length,
          violators: ungroundedContradictions.map((c) => c.id),
        });
      }

      // 4. Retrieve agent runs to perform Sufficiency Check
      const agentRuns = await agentRunRepository.getAgentRunsByResearchId(researchId);
      const isUSAsset = identity.country === "US" || identity.country === "United States" ||
        (identity.exchange?.toUpperCase() || "").includes("NASDAQ") ||
        (identity.exchange?.toUpperCase() || "").includes("NYSE");

      const sufficiencyResult = checkSufficiency(evidenceList, agentRuns, isUSAsset);

      // 5. Calculate Scores with Sufficiency status
      await researchRepository.updateCurrentNode(researchId, "scoring");
      const scores = calculateScores(evidenceList, contradictionsList, sufficiencyResult.sufficient);

      // Save scores to DB (scores will be nullable if sufficiency gate is blocked)
      await scoreRepository.upsertScore({
        id: generateId("score"),
        researchId,
        business: scores.business !== null ? String(scores.business) : null,
        financial: scores.financial !== null ? String(scores.financial) : null,
        valuation: scores.valuation !== null ? String(scores.valuation) : null,
        news: scores.news !== null ? String(scores.news) : null,
        risk: scores.risk !== null ? String(scores.risk) : null,
        evidenceQuality: scores.evidenceQuality !== null ? String(scores.evidenceQuality) : null,
        contradictionPenalty: scores.contradictionPenalty !== null ? String(scores.contradictionPenalty) : null,
        finalScore: scores.final !== null ? String(scores.final) : null,
        decision: scores.decision,
        scoreBreakdown: scores.breakdown ? JSON.stringify(scores.breakdown) : null,
        createdAt: new Date(),
      });

      // 6. Synthesize Research Report or Degradation Fallback
      let finalOutcome: "sufficient" | "insufficient_evidence" | "asset_unresolved" | "provider_failure" | "partial" | "synthesis_degraded" | "interrupted" = sufficiencyResult.outcome;
      
      if (sufficiencyResult.sufficient) {
        await researchRepository.updateCurrentNode(researchId, "committee");
        const synthesisResult = await synthesizeResearchReport(researchId, ticker, evidenceList, scores);
        
        if (!synthesisResult.success) {
          finalOutcome = "synthesis_degraded";
          sufficiencyResult.limitations.push("LLM Report Synthesis failed due to provider limits.");
        }
      } else {
        logger.warn("Coordinator: Research insufficient, skipping report synthesis", {
          researchId,
          reasons: sufficiencyResult.reasons,
        });
        
        // Write empty report row so frontend DB query doesn't miss the relation
        await reportRepository.upsertReport({
          id: generateId("rep"),
          researchId,
          thesis: "",
          bullCase: JSON.stringify([]),
          bearCase: JSON.stringify([]),
          keyRisks: JSON.stringify([]),
          summary: "",
          createdAt: new Date(),
        });
      }

      // 7. Complete/Interrupt Run
      let finalStatus: "completed" | "interrupted" | "failed" = "completed";
      if ((finalOutcome as string) === "provider_failure" || (finalOutcome as string) === "partial" || (finalOutcome as string) === "interrupted") {
        finalStatus = "interrupted";
        finalOutcome = "interrupted";
      }

      await researchRepository.updateCurrentNode(researchId, "completed");
      await researchRepository.markCompleted(
        researchId,
        companyName,
        finalOutcome,
        sufficiencyResult.reasons,
        sufficiencyResult.limitations,
        finalStatus
      );

      logger.info("Coordinator: Pipeline successfully finished execution", { researchId, ticker });
    } catch (error: any) {
      logger.error("Coordinator: Pipeline execution failed", { researchId, error });
      const userSafeErrorMessage = sanitizeErrorMessage(error.message || String(error));
      try {
        await researchRepository.markFailed(researchId, userSafeErrorMessage);
      } catch (dbErr) {
        logger.warn("Coordinator: Failed to mark run as failed in database", { dbErr });
      }
      throw error;
    }
  }
};
