import { NextRequest, NextResponse } from "next/server";
import { researchRepository } from "@/src/db/repositories/research.repository";
import { scoreRepository } from "@/src/db/repositories/score.repository";
import { reportRepository } from "@/src/db/repositories/report.repository";

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

    const score = await scoreRepository.getScoreByResearchId(id);
    const report = await reportRepository.getReportByResearchId(id);

    // Parse stringified JSON fields in report if it exists
    let formattedReport = null;
    if (report) {
      try {
        formattedReport = {
          ...report,
          bullCase: JSON.parse(report.bullCase),
          bearCase: JSON.parse(report.bearCase),
          keyRisks: JSON.parse(report.keyRisks),
        };
      } catch (e) {
        formattedReport = report;
      }
    }

    return NextResponse.json({
      run,
      score,
      report: formattedReport,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
