import { eq, and, gt } from "drizzle-orm";
import { getDb } from "../index";
import { apiCache } from "../schema/tables";

export const cacheRepository = {
  async getValid(provider: string, cacheKey: string) {
    const db = getDb();
    const now = new Date();
    const [entry] = await db
      .select()
      .from(apiCache)
      .where(
        and(
          eq(apiCache.provider, provider),
          eq(apiCache.cacheKey, cacheKey),
          gt(apiCache.expiresAt, now)
        )
      )
      .limit(1);
    return entry ? JSON.parse(entry.payload) : null;
  },

  async set(data: typeof apiCache.$inferInsert) {
    const db = getDb();
    const [inserted] = await db
      .insert(apiCache)
      .values(data)
      .onConflictDoUpdate({
        target: apiCache.id,
        set: {
          payload: data.payload,
          expiresAt: data.expiresAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return inserted;
  }
};
