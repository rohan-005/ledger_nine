import { ResearchScores, ScoreCategoryBreakdown, parseScore } from "@/src/types/frontend";

interface ScoreBarProps {
  label: string;
  value: number;
  max?: number;
  isPenalty?: boolean;
}

function ScoreBar({ label, value, max = 100, isPenalty = false }: ScoreBarProps) {
  const clamped = Math.max(0, Math.min(max, Math.abs(value)));
  const pct = (clamped / max) * 100;
  const color = isPenalty
    ? "bg-red-600"
    : value >= 65
    ? "bg-green-500"
    : value >= 45
    ? "bg-yellow-500"
    : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-sm">
        <span className="text-neutral-300 font-medium">{label}</span>
        <span className={`font-mono font-bold ${isPenalty ? "text-red-400" : "text-neutral-100"}`}>
          {isPenalty ? `−${value.toFixed(1)}` : value.toFixed(1)}
        </span>
      </div>
      <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        />
      </div>
    </div>
  );
}

interface BreakdownDetailProps {
  label: string;
  breakdown: ScoreCategoryBreakdown;
}

function BreakdownDetail({ label, breakdown }: BreakdownDetailProps) {
  return (
    <details className="border border-neutral-800 rounded bg-neutral-950 group">
      <summary className="flex items-center justify-between px-4 py-2 cursor-pointer select-none text-sm font-medium text-neutral-300 hover:text-neutral-100 list-none">
        <span>{label} — Breakdown</span>
        <span className="text-neutral-500 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-4 pb-4 pt-2 space-y-3 text-xs text-neutral-400 border-t border-neutral-800">
        {breakdown.contributingFactors.length > 0 && (
          <div>
            <p className="text-neutral-300 font-semibold mb-1">Contributing Factors</p>
            <ul className="space-y-0.5 list-disc list-inside">
              {breakdown.contributingFactors.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}
        {breakdown.positiveImpacts.length > 0 && (
          <div>
            <p className="text-green-400 font-semibold mb-1">Positive Signals</p>
            <ul className="space-y-0.5 list-disc list-inside">
              {breakdown.positiveImpacts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}
        {breakdown.negativeImpacts.length > 0 && (
          <div>
            <p className="text-red-400 font-semibold mb-1">Negative Signals</p>
            <ul className="space-y-0.5 list-disc list-inside">
              {breakdown.negativeImpacts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}
        {breakdown.relevantEvidenceIds.length > 0 && (
          <div>
            <p className="text-neutral-300 font-semibold mb-1">Linked Evidence IDs</p>
            <div className="flex flex-wrap gap-1">
              {breakdown.relevantEvidenceIds.map((id) => (
                <span key={id} className="font-mono text-xs bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">{id}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

export default function ScoreOverview({ score }: { score: ResearchScores }) {
  const b = parseScore(score.business);
  const f = parseScore(score.financial);
  const v = parseScore(score.valuation);
  const n = parseScore(score.news);
  const r = parseScore(score.risk);
  const eq = parseScore(score.evidenceQuality);
  const cp = parseScore(score.contradictionPenalty);
  const final = parseScore(score.finalScore);

  const bd = score.scoreBreakdown;

  return (
    <section id="scores" aria-labelledby="scores-heading" className="space-y-4">
      <h2 id="scores-heading" className="text-lg font-bold text-neutral-100 border-b border-neutral-800 pb-2">
        Score Overview
      </h2>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
        <ScoreBar label="Business Quality" value={b} />
        <ScoreBar label="Financial Health" value={f} />
        <ScoreBar label="Valuation" value={v} />
        <ScoreBar label="News & Macro" value={n} />
        <ScoreBar label="Risk Profile" value={r} />
        <ScoreBar label="Evidence Quality" value={eq} />
        <div className="border-t border-neutral-800 pt-3">
          <ScoreBar label="Contradiction Penalty" value={cp} isPenalty />
        </div>
        <div className="border-t border-neutral-800 pt-3">
          <ScoreBar label="Final Score" value={final} />
        </div>
      </div>

      {bd && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
            Category Breakdowns
          </h3>
          {bd.business && <BreakdownDetail label="Business Quality" breakdown={bd.business} />}
          {bd.financial && <BreakdownDetail label="Financial Health" breakdown={bd.financial} />}
          {bd.valuation && <BreakdownDetail label="Valuation" breakdown={bd.valuation} />}
          {bd.news && <BreakdownDetail label="News & Macro" breakdown={bd.news} />}
          {bd.risk && <BreakdownDetail label="Risk Profile" breakdown={bd.risk} />}
          {bd.evidenceQuality && <BreakdownDetail label="Evidence Quality" breakdown={bd.evidenceQuality} />}
        </div>
      )}
    </section>
  );
}
