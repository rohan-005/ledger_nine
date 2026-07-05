import "server-only";
import { generateId } from "@/src/lib/ids";
import { agentRunRepository } from "@/src/db/repositories/agent-run.repository";
import { logger } from "@/src/lib/logger";
import { SkippedError } from "@/src/lib/errors";

export async function runAgent<T>(
  researchId: string,
  agentId: string,
  executeFn: (agentRunId: string) => Promise<{
    data: T;
    provider: string;
    model: string;
  }>
): Promise<T> {
  const agentRunId = generateId("run").replace("run_", "ar_");
  const startedAt = new Date();

  logger.info("Starting agent run", { researchId, agentId, agentRunId });
  await agentRunRepository.startAgentRun({
    id: agentRunId,
    researchId,
    agentId,
    status: "started",
    startedAt,
    fallbackUsed: false,
  });

  try {
    const { data, provider, model } = await executeFn(agentRunId);
    const latencyMs = Date.now() - startedAt.getTime();

    logger.info("Completing agent run", { researchId, agentId, agentRunId, provider, model, latencyMs });
    await agentRunRepository.completeAgentRun(agentRunId, provider, model, latencyMs);

    return data;
  } catch (error: unknown) {
    const latencyMs = Date.now() - startedAt.getTime();
    
    if (error instanceof SkippedError) {
      logger.info("Skipping agent run due to SkippedError signal", { researchId, agentId, agentRunId, reason: error.message });
      try {
        await agentRunRepository.skipAgentRun(agentRunId, error.message);
      } catch (dbErr) {
        logger.warn("Failed to mark agent run as skipped in database", { dbErr });
      }
      // Return empty array as standard agent output when skipped
      return [] as unknown as T;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Agent run failed", { researchId, agentId, agentRunId, errorMessage });

    try {
      await agentRunRepository.failAgentRun(agentRunId, errorMessage, undefined, undefined, latencyMs);
    } catch (dbErr) {
      logger.warn("Failed to mark agent run as failed in database", { dbErr });
    }
    throw error;
  }
}
