import { NextRequest, NextResponse } from "next/server";
import { researchRepository } from "@/src/db/repositories/research.repository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const run = await researchRepository.getRunById(id);
    if (!run) {
      return NextResponse.json({ error: "Research run not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: run.id,
      ticker: run.ticker,
      companyName: run.companyName,
      status: run.status,
      currentNode: run.currentNode,
      errorMessage: run.errorMessage,
      outcome: run.outcome ?? null,
      insufficiencyReasons: run.insufficiencyReasons ? JSON.parse(run.insufficiencyReasons) : [],
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
