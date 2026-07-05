import { eq } from "drizzle-orm";
import { getDb } from "../index";
import { evidence } from "../schema/tables";

export const evidenceRepository = {
  async insertEvidence(data: typeof evidence.$inferInsert) {
    const db = getDb();
    const [inserted] = await db.insert(evidence).values(data).returning();
    return inserted;
  },

  async insertManyEvidence(data: (typeof evidence.$inferInsert)[]) {
    if (data.length === 0) return [];
    const db = getDb();
    return db.insert(evidence).values(data).returning();
  },

  async getEvidenceByResearchId(researchId: string) {
    const db = getDb();
    return db.select().from(evidence).where(eq(evidence.researchId, researchId));
  }
};
