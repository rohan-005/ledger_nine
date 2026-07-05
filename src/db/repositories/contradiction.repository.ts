import { eq } from "drizzle-orm";
import { getDb } from "../index";
import { contradictions } from "../schema/tables";

export const contradictionRepository = {
  async insertContradictions(data: (typeof contradictions.$inferInsert)[]) {
    if (data.length === 0) return [];
    const db = getDb();
    return db.insert(contradictions).values(data).returning();
  },

  async getContradictionsByResearchId(researchId: string) {
    const db = getDb();
    return db.select().from(contradictions).where(eq(contradictions.researchId, researchId));
  }
};
