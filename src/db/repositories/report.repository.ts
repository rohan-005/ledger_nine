import { eq } from "drizzle-orm";
import { getDb } from "../index";
import { researchReports } from "../schema/tables";

export const reportRepository = {
  async upsertReport(data: typeof researchReports.$inferInsert) {
    const db = getDb();
    const [inserted] = await db
      .insert(researchReports)
      .values(data)
      .onConflictDoUpdate({
        target: researchReports.researchId,
        set: {
          thesis: data.thesis,
          bullCase: data.bullCase,
          bearCase: data.bearCase,
          keyRisks: data.keyRisks,
          summary: data.summary,
        },
      })
      .returning();
    return inserted;
  },

  async getReportByResearchId(researchId: string) {
    const db = getDb();
    const [report] = await db.select().from(researchReports).where(eq(researchReports.researchId, researchId)).limit(1);
    return report || null;
  }
};
