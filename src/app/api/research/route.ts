import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { researchCoordinator } from "@/src/core/coordinator/research-coordinator";
import { logger } from "@/src/lib/logger";

const START_RESEARCH_SCHEMA = z.object({
  ticker: z.string().min(1).max(16),
  investmentHorizon: z.string().min(1).max(64),
  riskTolerance: z.enum(["low", "moderate", "high"]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = START_RESEARCH_SCHEMA.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { ticker, investmentHorizon, riskTolerance } = parsed.data;
    const researchId = await researchCoordinator.startResearch(ticker, investmentHorizon, riskTolerance);

    return NextResponse.json({ researchId, status: "queued" }, { status: 201 });
  } catch (error: any) {
    logger.error("API: Failed to start research run", error);
    return NextResponse.json(
      {
        error: {
          code: "RESEARCH_RUN_CREATION_FAILED",
          message: "We couldn't start this research run. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
