import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseUrl } from "@/src/lib/env";
import { DatabaseError } from "@/src/lib/errors";
import * as schema from "./schema/tables";

// Reuse connection across hot reloads in development
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let clientInstance: postgres.Sql | null = null;

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const connectionString = getDatabaseUrl();
    if (!clientInstance) {
      clientInstance = postgres(connectionString, {
        max: 10,
        ssl: { rejectUnauthorized: false }, // safe default for Neon SSL
      });
    }
    dbInstance = drizzle(clientInstance, { schema });
    return dbInstance;
  } catch (error: unknown) {
    throw new DatabaseError("Failed to initialize database connection. Ensure DATABASE_URL is configured.", false, error);
  }
}
