import { eq } from "drizzle-orm";
import { getDb } from "../index";
import { researchRuns } from "../schema/tables";

export const researchRepository = {
  async createRun(data: typeof researchRuns.$inferInsert) {
    const db = getDb();
    const [inserted] = await db.insert(researchRuns).values(data).returning();
    return inserted;
  },

  async getRunById(id: string) {
    const db = getDb();
    const [run] = await db.select().from(researchRuns).where(eq(researchRuns.id, id)).limit(1);
    return run || null;
  },

  async updateStatus(id: string, status: "queued" | "running" | "completed" | "failed", errMessage?: string) {
    const db = getDb();
    await db.update(researchRuns).set({
      status,
      errorMessage: errMessage || null,
      updatedAt: new Date(),
    }).where(eq(researchRuns.id, id));
  },

  async updateCurrentNode(id: string, currentNode: string) {
    const db = getDb();
    await db.update(researchRuns).set({
      currentNode,
      updatedAt: new Date(),
    }).where(eq(researchRuns.id, id));
  },

  async markCompleted(
    id: string,
    companyName?: string,
    outcome?: "sufficient" | "insufficient_evidence" | "asset_unresolved" | "provider_failure" | "partial" | "synthesis_degraded",
    insufficiencyReasons?: string[],
    researchLimitations?: string[]
  ) {
    const db = getDb();
    await db.update(researchRuns).set({
      status: "completed",
      companyName: companyName || null,
      outcome: outcome || null,
      insufficiencyReasons: insufficiencyReasons ? JSON.stringify(insufficiencyReasons) : null,
      researchLimitations: researchLimitations ? JSON.stringify(researchLimitations) : null,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(researchRuns.id, id));
  },

  async markFailed(id: string, errorMessage: string) {
    const db = getDb();
    await db.update(researchRuns).set({
      status: "failed",
      errorMessage,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(researchRuns.id, id));
  }
};
