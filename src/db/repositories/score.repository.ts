import { eq } from "drizzle-orm";
import { getDb } from "../index";
import { researchScores } from "../schema/tables";

export const scoreRepository = {
  async upsertScore(data: typeof researchScores.$inferInsert) {
    const db = getDb();
    const [inserted] = await db
      .insert(researchScores)
      .values(data)
      .onConflictDoUpdate({
        target: researchScores.researchId,
        set: {
          business: data.business,
          financial: data.financial,
          valuation: data.valuation,
          news: data.news,
          risk: data.risk,
          evidenceQuality: data.evidenceQuality,
          contradictionPenalty: data.contradictionPenalty,
          finalScore: data.finalScore,
          decision: data.decision,
          scoreBreakdown: data.scoreBreakdown,
        },
      })
      .returning();
    return inserted;
  },

  async getScoreByResearchId(researchId: string) {
    const db = getDb();
    const [score] = await db.select().from(researchScores).where(eq(researchScores.researchId, researchId)).limit(1);
    return score || null;
  }
};
