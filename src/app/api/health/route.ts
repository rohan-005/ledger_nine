import { NextResponse } from "next/server";
import { getDb } from "@/src/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();
    // Execute a simple test query to verify connectivity
    await db.execute(sql`SELECT 1`);
    
    return NextResponse.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error.message || String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
