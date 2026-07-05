import { eq } from "drizzle-orm";
import { getDb } from "../index";
import { agentRuns } from "../schema/tables";

export const agentRunRepository = {
  async startAgentRun(data: typeof agentRuns.$inferInsert) {
    const db = getDb();
    const [inserted] = await db.insert(agentRuns).values(data).returning();
    return inserted;
  },

  async completeAgentRun(id: string, provider: string, model: string, latencyMs: number) {
    const db = getDb();
    await db.update(agentRuns).set({
      status: "completed",
      provider,
      model,
      latencyMs,
      completedAt: new Date(),
    }).where(eq(agentRuns.id, id));
  },

  async failAgentRun(id: string, errorMessage: string, provider?: string, model?: string, latencyMs?: number) {
    const db = getDb();
    await db.update(agentRuns).set({
      status: "failed",
      errorMessage,
      provider: provider || null,
      model: model || null,
      latencyMs: latencyMs || null,
      completedAt: new Date(),
    }).where(eq(agentRuns.id, id));
  },

  async recordFallback(id: string, reason: string) {
    const db = getDb();
    await db.update(agentRuns).set({
      fallbackUsed: true,
      fallbackReason: reason,
    }).where(eq(agentRuns.id, id));
  },

  async getAgentRunsByResearchId(researchId: string) {
    const db = getDb();
    return db.select().from(agentRuns).where(eq(agentRuns.researchId, researchId));
  }
};
