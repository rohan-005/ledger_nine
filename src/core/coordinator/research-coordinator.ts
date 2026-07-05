import "server-only";
import { generateId } from "@/src/lib/ids";
import { logger } from "@/src/lib/logger";
import { researchRepository } from "@/src/db/repositories/research.repository";
import { scoreRepository } from "@/src/db/repositories/score.repository";
import { orchestrateSpecialists } from "../agents/orchestrator";
import { runContradictionDetector, synthesizeResearchReport } from "../consensus/consensus";
import { calculateScores } from "../scoring/scoring-engine";
import { fmpClient } from "@/src/integrations/fmp/fmp.client";

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
      startedAt: new Date(),
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
      // 1. Fetch Company Name
      let companyName = ticker;
      try {
        const profile = await fmpClient.getCompanyProfile(ticker);
        if (profile && typeof profile.companyName === "string") {
          companyName = profile.companyName;
        }
      } catch (err) {
        logger.warn("Coordinator: Failed to retrieve company profile, using ticker as name", { ticker, error: err });
      }

      // 2. Run Specialist Agents in parallel
      await researchRepository.updateCurrentNode(researchId, "specialists");
      const evidenceList = await orchestrateSpecialists(researchId, ticker);

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

      // 4. Calculate Scores
      await researchRepository.updateCurrentNode(researchId, "scoring");
      const scores = calculateScores(evidenceList, contradictionsList);

      // Save scores to DB
      await scoreRepository.upsertScore({
        id: generateId("score"),
        researchId,
        business: String(scores.business),
        financial: String(scores.financial),
        valuation: String(scores.valuation),
        news: String(scores.news),
        risk: String(scores.risk),
        evidenceQuality: String(scores.evidenceQuality),
        contradictionPenalty: String(scores.contradictionPenalty),
        finalScore: String(scores.final),
        decision: scores.decision,
        scoreBreakdown: scores.breakdown ? JSON.stringify(scores.breakdown) : null,
        createdAt: new Date(),
      });

      // 5. Synthesize Research Report
      await researchRepository.updateCurrentNode(researchId, "committee");
      await synthesizeResearchReport(researchId, ticker, evidenceList, scores);

      // 6. Complete Run
      await researchRepository.updateCurrentNode(researchId, "completed");
      await researchRepository.markCompleted(researchId, companyName);

      logger.info("Coordinator: Pipeline successfully finished execution", { researchId, ticker });
    } catch (error: any) {
      logger.error("Coordinator: Pipeline execution failed", { researchId, error });
      await researchRepository.markFailed(researchId, error.message || String(error));
      throw error;
    }
  }
};
