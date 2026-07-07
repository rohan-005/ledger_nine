import { NextRequest, NextResponse } from "next/server";
import { runAllProviderHealthChecks } from "@/src/lib/providers/healthCheck";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    const health = await runAllProviderHealthChecks(force);

    return NextResponse.json(health);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
