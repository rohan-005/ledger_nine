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

    // Parse stringified JSON fields in run
    const formattedRun = {
      ...run,
      insufficiencyReasons: run.insufficiencyReasons ? JSON.parse(run.insufficiencyReasons) : [],
      researchLimitations: run.researchLimitations ? JSON.parse(run.researchLimitations) : [],
    };

    const score = await scoreRepository.getScoreByResearchId(id);
    const report = await reportRepository.getReportByResearchId(id);

    // Parse scoreBreakdown in score if it exists
    let formattedScore = null;
    if (score) {
      try {
        formattedScore = {
          ...score,
          scoreBreakdown: score.scoreBreakdown ? JSON.parse(score.scoreBreakdown) : null,
        };
      } catch (e) {
        formattedScore = score;
      }
    }

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
      run: formattedRun,
      score: formattedScore,
      report: formattedReport,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
