import { NextRequest, NextResponse } from "next/server";
import { agentRunRepository } from "@/src/db/repositories/agent-run.repository";
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
    const agentRuns = await agentRunRepository.getAgentRunsByResearchId(id);
    return NextResponse.json({ agentRuns });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
