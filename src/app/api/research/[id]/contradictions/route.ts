import { NextRequest, NextResponse } from "next/server";
import { contradictionRepository } from "@/src/db/repositories/contradiction.repository";
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
    const contradictions = await contradictionRepository.getContradictionsByResearchId(id);
    return NextResponse.json({ contradictions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
