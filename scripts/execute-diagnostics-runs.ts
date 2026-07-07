import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { researchCoordinator } from "../src/core/coordinator/research-coordinator";
import { researchRepository } from "../src/db/repositories/research.repository";
import { agentRunRepository } from "../src/db/repositories/agent-run.repository";
import { evidenceRepository } from "../src/db/repositories/evidence.repository";
import { contradictionRepository } from "../src/db/repositories/contradiction.repository";
import { scoreRepository } from "../src/db/repositories/score.repository";
import { reportRepository } from "../src/db/repositories/report.repository";
import { resolveSymbol } from "../src/lib/market/symbolResolver";

async function executeRun(query: string) {
  console.log(`\n==================================================`);
  console.log(`🚀 EXECUTING COMPLETE RUN FOR: "${query}"`);
  console.log(`==================================================`);

  // Resolve first to log resolver inputs/outputs
  const resolved = await resolveSymbol(query);
  if (!resolved) {
    console.log(`❌ Resolver failed for query: "${query}"`);
    return;
  }

  console.log(`Resolved Company Details:`);
  console.log(`  - name: ${resolved.companyName}`);
  console.log(`  - displayTicker: ${resolved.displayTicker}`);
  console.log(`  - canonicalTicker: ${resolved.canonicalTicker}`);
  console.log(`  - exchange: ${resolved.exchange}`);
  console.log(`  - country: ${resolved.country}`);
  console.log(`  - Finnhub symbol: ${resolved.providerSymbols.finnhub}`);
  console.log(`  - FMP symbol: ${resolved.providerSymbols.fmp}`);
  console.log(`  - NewsAPI query: ${resolved.providerSymbols.newsapi}`);
  console.log(`  - Tavily query: ${resolved.providerSymbols.tavily}`);

  // Start research run
  const researchId = await researchCoordinator.startResearch(resolved.displayTicker, "3 years", "moderate");
  console.log(`Created Research Run: ${researchId}. Polling database...`);

  // Poll database
  let attempts = 0;
  let runData: any = null;
  while (attempts < 60) {
    runData = await researchRepository.getRunById(researchId);
    if (runData && (runData.status === "completed" || runData.status === "failed" || runData.status === "interrupted")) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts++;
  }

  if (!runData) {
    console.log(`❌ Timeout or run not found in DB: ${researchId}`);
    return;
  }

  console.log(`\nRun Final Status:`);
  console.log(`  - Status: ${runData.status}`);
  console.log(`  - Outcome: ${runData.outcome}`);
  console.log(`  - Limitations: ${runData.researchLimitations}`);
  console.log(`  - Insufficiency Reasons: ${runData.insufficiencyReasons}`);
  console.log(`  - Error Message: ${runData.errorMessage}`);

  // Retrieve all other tables
  const agentRuns = await agentRunRepository.getAgentRunsByResearchId(researchId);
  const evidenceItems = await evidenceRepository.getEvidenceByResearchId(researchId);
  const contradictions = await contradictionRepository.getContradictionsByResearchId(researchId);
  const scores = await scoreRepository.getScoreByResearchId(researchId);
  const report = await reportRepository.getReportByResearchId(researchId);

  console.log(`\nAgent Runs Statuses:`);
  agentRuns.forEach((r) => {
    console.log(`  - ${r.agentId}: status=${r.status}, error=${r.errorMessage}, latency=${r.latencyMs}ms, provider=${r.provider}`);
  });

  console.log(`\nEvidence Items (${evidenceItems.length}):`);
  evidenceItems.forEach((e, idx) => {
    console.log(`  [${idx + 1}] Category: ${e.category}, Source: ${e.sourceType}, Claim: "${e.claim}"`);
  });

  console.log(`\nContradictions (${contradictions.length}):`);
  contradictions.forEach((c) => {
    console.log(`  - Severity: ${c.severity}, Description: "${c.description}"`);
  });

  console.log(`\nScore & Decision:`);
  if (scores) {
    console.log(`  - Final Score: ${scores.finalScore}`);
    console.log(`  - Decision Verdict: ${scores.decision}`);
    console.log(`  - Old pillars: business=${scores.business}, financial=${scores.financial}, valuation=${scores.valuation}, news=${scores.news}, risk=${scores.risk}`);
    console.log(`  - 8 pillars: financialQuality=${scores.financialQuality}, growthQuality=${scores.growthQuality}, businessQuality=${scores.businessQuality}, competitivePosition=${scores.competitivePosition}, managementGovernance=${scores.managementGovernance}, earningsQuality=${scores.earningsQuality}`);
    console.log(`  - Contradiction Penalty: ${scores.contradictionPenalty}`);
  } else {
    console.log(`  - Scores: None`);
  }

  console.log(`\nReport Summary:`);
  if (report) {
    console.log(`  - Thesis: "${report.thesis}"`);
    console.log(`  - Summary: "${report.summary}"`);
  } else {
    console.log(`  - Report: None`);
  }
  
  console.log(`==================================================\n`);
}

async function main() {
  const targets = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "AAPL"];
  for (const query of targets) {
    try {
      await executeRun(query);
    } catch (err: any) {
      console.error(`Error executing run for ${query}:`, err.message || err);
    }
  }
}

main().catch((err) => console.error("Fatal error:", err));
