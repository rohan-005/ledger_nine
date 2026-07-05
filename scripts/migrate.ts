import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { getDatabaseUrl } from "../src/lib/env";

async function main() {
  console.log("⏳ Running migrations...");
  const connectionString = getDatabaseUrl();
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);
  
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ Migrations applied successfully!");
  await sql.end();
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
