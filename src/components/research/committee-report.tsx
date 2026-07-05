import { CommitteeReport as CommitteeReportType } from "@/src/types/frontend";

export default function CommitteeReport({ report }: { report: CommitteeReportType }) {
  return (
    <section id="report" aria-labelledby="report-heading" className="space-y-4">
      <h2 id="report-heading" className="text-lg font-bold text-neutral-100 border-b border-neutral-800 pb-2">
        Investment Committee Synthesis
      </h2>

      <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg px-4 py-3 text-sm text-amber-200/80">
        <strong>Note:</strong> The final investment decision (INVEST / PASS) is computed by the deterministic
        scoring engine — not by this committee. The committee synthesizes the supporting research narrative only.
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-5">
        {/* Thesis */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-1">Investment Thesis</h3>
          <p className="text-neutral-100 leading-relaxed">{report.thesis}</p>
        </div>

        {/* Summary */}
        <div className="border-t border-neutral-800 pt-4">
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-1">Summary</h3>
          <p className="text-neutral-200 leading-relaxed text-sm">{report.summary}</p>
        </div>

        {/* Bull & Bear */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-neutral-800 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wide mb-2">Bull Case</h3>
            <ul className="space-y-1.5">
              {report.bullCase.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm text-neutral-200">
                  <span className="text-green-500 mt-0.5 shrink-0">+</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-2">Bear Case</h3>
            <ul className="space-y-1.5">
              {report.bearCase.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm text-neutral-200">
                  <span className="text-red-500 mt-0.5 shrink-0">−</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Key Risks */}
        <div className="border-t border-neutral-800 pt-4">
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-2">Key Risks</h3>
          <ul className="space-y-1.5">
            {report.keyRisks.map((risk, i) => (
              <li key={i} className="flex gap-2 text-sm text-neutral-200">
                <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
