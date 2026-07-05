import { NextRequest, NextResponse } from "next/server";
import { evidenceRepository } from "@/src/db/repositories/evidence.repository";
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
    const evidenceList = await evidenceRepository.getEvidenceByResearchId(id);
    return NextResponse.json({ evidence: evidenceList });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
