import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { researchCoordinator } from "../src/core/coordinator/research-coordinator";
import { researchRepository } from "../src/db/repositories/research.repository";
import { scoreRepository } from "../src/db/repositories/score.repository";
import { evidenceRepository } from "../src/db/repositories/evidence.repository";
import { contradictionRepository } from "../src/db/repositories/contradiction.repository";
import { agentRunRepository } from "../src/db/repositories/agent-run.repository";
import { generateId } from "../src/lib/ids";
import { logger } from "../src/lib/logger";

interface EvaluationMetrics {
  ticker: string;
  researchId: string;
  status: string;
  finalScore: number | string;
  decision: string;
  businessScore: number | string;
  financialScore: number | string;
  valuationScore: number | string;
  newsScore: number | string;
  riskScore: number | string;
  evidenceQuality: number | string;
  contradictionPenalty: number | string;
  evidenceCount: number;
  contradictionCount: number;
  targetedResearchAttempts: number;
  fallbackCount: number;
  totalDurationMs: number;
  agentFailures: string[];
  missingEvidenceCategories: string[];
}

async function evaluateTicker(ticker: string): Promise<EvaluationMetrics> {
  const researchId = generateId("run");
  const cleanTicker = ticker.toUpperCase().trim();
  const startTime = Date.now();

  logger.info(`Starting evaluation run for ${cleanTicker}...`, { researchId });

  // Initialize in DB
  await researchRepository.createRun({
    id: researchId,
    ticker: cleanTicker,
    companyName: cleanTicker,
    investmentHorizon: "1-2 years",
    riskTolerance: "moderate",
    status: "queued",
    startedAt: new Date(),
  });

  let errorOccurred = false;
  try {
    await researchCoordinator.executeResearch(researchId, cleanTicker, "1-2 years", "moderate");
  } catch (err: any) {
    logger.error(`Pipeline execution failed for ${cleanTicker}`, { researchId, error: err });
    errorOccurred = true;
  }

  const duration = Date.now() - startTime;

  // Retrieve metrics from repositories
  const run = await researchRepository.getRunById(researchId);
  const score = await scoreRepository.getScoreByResearchId(researchId);
  const evidenceList = await evidenceRepository.getEvidenceByResearchId(researchId);
  const contradictionsList = await contradictionRepository.getContradictionsByResearchId(researchId);
  const agentRuns = await agentRunRepository.getAgentRunsByResearchId(researchId);

  // Group evidence by category
  const categories = ["business", "financial", "valuation", "news", "risk"] as const;
  const missingCategories: string[] = [];
  for (const cat of categories) {
    const count = evidenceList.filter((e) => e.category === cat).length;
    if (count === 0) {
      missingCategories.push(cat);
    }
  }

  const agentFailures = agentRuns
    .filter((ar) => ar.status === "failed")
    .map((ar) => `${ar.agentId}: ${ar.errorMessage || "Unknown error"}`);

  const fallbackCount = agentRuns.filter((ar) => ar.fallbackUsed).length;

  return {
    ticker: cleanTicker,
    researchId,
    status: run?.status || (errorOccurred ? "failed" : "unknown"),
    finalScore: score?.finalScore ? Number(score.finalScore) : "N/A",
    decision: score?.decision || "N/A",
    businessScore: score?.business ? Number(score.business) : "N/A",
    financialScore: score?.financial ? Number(score.financial) : "N/A",
    valuationScore: score?.valuation ? Number(score.valuation) : "N/A",
    newsScore: score?.news ? Number(score.news) : "N/A",
    riskScore: score?.risk ? Number(score.risk) : "N/A",
    evidenceQuality: score?.evidenceQuality ? Number(score.evidenceQuality) : "N/A",
    contradictionPenalty: score?.contradictionPenalty ? Number(score.contradictionPenalty) : "N/A",
    evidenceCount: evidenceList.length,
    contradictionCount: contradictionsList.length,
    targetedResearchAttempts: agentRuns.length,
    fallbackCount,
    totalDurationMs: duration,
    agentFailures,
    missingEvidenceCategories: missingCategories,
  };
}

async function main() {
  console.log("==================================================");
  console.log("🚀 STARTING RESEARCH ENGINE EVALUATION HARNESS");
  console.log("==================================================");

  const tickers = ["AAPL", "INTC", "TSLA"];
  const results: EvaluationMetrics[] = [];

  for (const ticker of tickers) {
    console.log(`\nEvaluating ticker: ${ticker}...`);
    try {
      const metrics = await evaluateTicker(ticker);
      results.push(metrics);
      console.log(`Finished evaluation for ${ticker}`);
    } catch (err: any) {
      console.error(`Fatal error evaluating ticker ${ticker}:`, err);
    }
  }

  console.log("\n==================================================");
  console.log("📊 EVALUATION RESULTS SUMMARY");
  console.log("==================================================");

  console.table(
    results.map((r) => ({
      Ticker: r.ticker,
      Status: r.status,
      Decision: r.decision,
      "Final Score": r.finalScore,
      "Evid. Count": r.evidenceCount,
      "Contra. Count": r.contradictionCount,
      "Agent Runs": r.targetedResearchAttempts,
      "Fallback Runs": r.fallbackCount,
      "Duration (s)": (r.totalDurationMs / 1000).toFixed(2),
    }))
  );

  console.log("\n==================================================");
  console.log("🔍 DETAILED METRICS PER PROFILE");
  console.log("==================================================");

  for (const r of results) {
    console.log(`\n📌 PROFILE: ${r.ticker} (${r.researchId})`);
    console.log(`--------------------------------------------------`);
    console.log(`- Status: ${r.status}`);
    console.log(`- Decision: ${r.decision}`);
    console.log(`- Final Score: ${r.finalScore} / 100`);
    console.log(`- Breakdown:`);
    console.log(`  - Business Score:     ${r.businessScore}`);
    console.log(`  - Financial Score:    ${r.financialScore}`);
    console.log(`  - Valuation Score:    ${r.valuationScore}`);
    console.log(`  - News Score:         ${r.newsScore}`);
    console.log(`  - Risk Score:         ${r.riskScore}`);
    console.log(`  - Evidence Quality:   ${r.evidenceQuality}`);
    console.log(`  - Contradiction Pen.: -${r.contradictionPenalty}`);
    console.log(`- Data Integrity:`);
    console.log(`  - Evidence Count: ${r.evidenceCount}`);
    console.log(`  - Contradiction Count: ${r.contradictionCount}`);
    console.log(`  - Missing Categories: ${r.missingEvidenceCategories.length > 0 ? r.missingEvidenceCategories.join(", ") : "None"}`);
    console.log(`- Execution Details:`);
    console.log(`  - Total Agent Runs: ${r.targetedResearchAttempts}`);
    console.log(`  - Fallbacks Triggered: ${r.fallbackCount}`);
    console.log(`  - Agent Failures: ${r.agentFailures.length > 0 ? r.agentFailures.join("; ") : "None"}`);
    console.log(`  - Duration: ${(r.totalDurationMs / 1000).toFixed(2)} seconds`);
  }

  console.log("\n==================================================");
  console.log("🎉 EVALUATION RUNS COMPLETED.");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal error in evaluation harness:", err);
  process.exit(1);
});
