import "server-only";
import { runFinancialAgent } from "./financial.agent";
import { runSecAgent } from "./sec.agent";
import { runMacroAgent } from "./macro.agent";
import { runEarningsAgent } from "./earnings.agent";
import { logger } from "@/src/lib/logger";
import { AssetIdentity } from "@/src/lib/research/asset-identity";

export async function orchestrateSpecialists(researchId: string, ticker: string, identity: AssetIdentity) {
  logger.info("Orchestrator: Executing specialist agents in parallel", { researchId, ticker });

  const results = await Promise.allSettled([
    runFinancialAgent(researchId, ticker),
    runSecAgent(researchId, ticker, undefined, identity),
    runMacroAgent(researchId, ticker),
    runEarningsAgent(researchId, ticker),
  ]);

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    logger.warn("Orchestrator: Some specialist agents failed during execution", {
      failures: failures.map((f) => (f as PromiseRejectedResult).reason?.message || String((f as PromiseRejectedResult).reason)),
    });
  } else {
    logger.info("Orchestrator: All specialist agents completed successfully");
  }

  // Gather all successfully inserted evidence items from resolved agent runs
  const allEvidence: any[] = [];
  results.forEach((r) => {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      allEvidence.push(...r.value);
    }
  });

  return allEvidence;
}
