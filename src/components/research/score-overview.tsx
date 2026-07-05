"use client";

import React from "react";
import { ResearchScores, ScoreCategoryBreakdown, parseScore } from "@/src/types/frontend";
import { getScoreBand } from "@/src/lib/presentation/helpers";
import { ScoreComparisonChart } from "./charts";
import { Card } from "@/src/components/ui/card";
import { Tooltip } from "@/src/components/ui/tooltip";

interface ScoreBarProps {
  label: string;
  value: number | null;
  max?: number;
  isPenalty?: boolean;
  tooltipText: string;
}

function ScoreBar({ label, value, max = 100, isPenalty = false, tooltipText }: ScoreBarProps) {
  if (value === null) {
    return (
      <div className="space-y-1.5 py-1 opacity-60">
        <div className="flex justify-between items-center text-sm">
          <span className="text-foreground-secondary font-medium">
            <Tooltip content={tooltipText}>{label}</Tooltip>
          </span>
          <span className="text-foreground-muted font-mono font-bold">N/A</span>
        </div>
        <div className="w-full bg-background border border-border/40 h-2.5 rounded-full overflow-hidden flex items-center justify-center">
          <span className="text-[9px] text-foreground-muted font-mono leading-none">Insufficient Data</span>
        </div>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(max, Math.abs(value)));
  const pct = (clamped / max) * 100;
  
  const band = getScoreBand(value);
  let color = "bg-emerald-500";
  if (isPenalty) color = "bg-red-500";
  else if (value < 40) color = "bg-red-600";
  else if (value < 55) color = "bg-red-400";
  else if (value < 70) color = "bg-amber-500";
  else if (value < 85) color = "bg-emerald-400";

  return (
    <div className="space-y-1.5 py-1">
      <div className="flex justify-between items-center text-sm">
        <span className="text-foreground-secondary font-medium">
          <Tooltip content={tooltipText}>{label}</Tooltip>
        </span>
        <div className="flex items-center gap-2">
          {!isPenalty && (
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${band.bg} ${band.color} ${band.border}`}>
              {band.label}
            </span>
          )}
          <span className={`font-mono font-bold ${isPenalty ? "text-red-600" : "text-foreground"}`}>
            {isPenalty ? `−${value.toFixed(1)}` : value.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="w-full bg-background border border-border h-2.5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
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
    <details className="border border-border rounded-xl bg-white group transition-all overflow-hidden">
      <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none text-sm font-semibold text-foreground hover:bg-surface-hover list-none">
        <span>{label} — Fact Analysis</span>
        <span className="text-foreground-secondary group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-5 pb-5 pt-3 space-y-4 text-xs text-foreground-secondary border-t border-border bg-surface-hover/50">
        {breakdown.contributingFactors.length > 0 && (
          <div>
            <p className="text-foreground font-bold mb-1.5">Key Factors Audited</p>
            <ul className="space-y-1 list-disc list-inside">
              {breakdown.contributingFactors.map((f, i) => (
                <li key={i} className="leading-relaxed">{f}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {breakdown.positiveImpacts.length > 0 && (
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3">
              <p className="text-emerald-800 font-bold mb-1.5">Positive Signals</p>
              <ul className="space-y-1 list-inside list-disc">
                {breakdown.positiveImpacts.map((f, i) => (
                  <li key={i} className="text-emerald-700 leading-relaxed">{f}</li>
                ))}
              </ul>
            </div>
          )}
          
          {breakdown.negativeImpacts.length > 0 && (
            <div className="bg-red-50/50 border border-red-100 rounded-lg p-3">
              <p className="text-red-800 font-bold mb-1.5">Negative Signals / Risks</p>
              <ul className="space-y-1 list-inside list-disc">
                {breakdown.negativeImpacts.map((f, i) => (
                  <li key={i} className="text-red-700 leading-relaxed">{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {breakdown.relevantEvidenceIds.length > 0 && (
          <div className="pt-2 border-t border-border/60">
            <p className="text-foreground-muted font-bold mb-1.5">Sources Evidence Reference</p>
            <div className="flex flex-wrap gap-1.5">
              {breakdown.relevantEvidenceIds.map((id) => (
                <span
                  key={id}
                  className="font-mono text-[10px] bg-background border border-border px-2 py-0.5 rounded text-foreground-secondary"
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

export default function ScoreOverview({ score }: { score: ResearchScores }) {
  const b = score.business !== null ? parseScore(score.business) : null;
  const f = score.financial !== null ? parseScore(score.financial) : null;
  const v = score.valuation !== null ? parseScore(score.valuation) : null;
  const n = score.news !== null ? parseScore(score.news) : null;
  const r = score.risk !== null ? parseScore(score.risk) : null;
  const eq = score.evidenceQuality !== null ? parseScore(score.evidenceQuality) : null;
  const cp = score.contradictionPenalty !== null ? parseScore(score.contradictionPenalty) : null;
  const final = score.finalScore !== null ? parseScore(score.finalScore) : null;

  const bd = score.scoreBreakdown;

  return (
    <section id="scores" aria-labelledby="scores-heading" className="space-y-6">
      <h2 id="scores-heading" className="text-xl font-bold text-foreground border-b border-border pb-2">
        Analytical Scores
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Progress Bars */}
        <div className="md:col-span-7 bg-white border border-border rounded-2xl p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-foreground-secondary uppercase tracking-wider mb-2">
            Pillar Scores
          </h3>
          <div className="space-y-3.5">
            <ScoreBar
              label="Business Strength"
              value={b}
              tooltipText="Analyzes business moat, market positioning, competitive advantages, and long-term viability."
            />
            <ScoreBar
              label="Financial Health"
              value={f}
              tooltipText="Audits solvency, debt levels, revenue growth, margins, and free cash flows."
            />
            <ScoreBar
              label="Valuation Metrics"
              value={v}
              tooltipText="Estimates margin of safety comparing present pricing vs. cash flow multipliers."
            />
            <ScoreBar
              label="News & Macro Sentiment"
              value={n}
              tooltipText="Aggregates web articles, executive changes, macro shifts, and product releases."
            />
            <ScoreBar
              label="Risk Profile"
              value={r}
              tooltipText="Estimates systematic exposure, management execution risk, and legal liabilities."
            />
            <ScoreBar
              label="Evidence quality score"
              value={eq}
              tooltipText="Weighted quality score measuring the reliability, source prestige, and verification rate of information."
            />
            {cp !== null && cp > 0 && (
              <div className="border-t border-border pt-4">
                <ScoreBar
                  label="Contradiction Penalty"
                  value={cp}
                  isPenalty
                  tooltipText="Subtracted points for mismatching or contradictory facts found across agents."
                />
              </div>
            )}
            <div className="border-t border-border pt-4 flex items-center justify-between">
              <span className="text-base font-bold text-foreground">
                <Tooltip content="The final synthesized metric, calculated deterministically. Required to exceed 65 to support an INVEST thesis.">
                  Synthesis Score
                </Tooltip>
              </span>
              <span className="text-2xl font-black text-foreground font-mono">
                {final !== null ? final.toFixed(1) : "N/A"}{" "}
                <span className="text-sm text-foreground-muted font-normal">/100</span>
              </span>
            </div>
          </div>
        </div>

        {/* Recharts Bar Chart */}
        <div className="md:col-span-5 bg-white border border-border rounded-2xl p-6 shadow-xs flex flex-col justify-between h-full min-h-[360px]">
          <div>
            <h3 className="text-sm font-bold text-foreground-secondary uppercase tracking-wider mb-1">
              Visual Profile
            </h3>
            <p className="text-xs text-foreground-muted mb-4">
              Comparing normalized pillar ratings. Higher values indicate positive quality.
            </p>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <ScoreComparisonChart score={score} />
          </div>
        </div>
      </div>

      {bd && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider">
            Detailed Pillar breakdowns
          </h3>
          <div className="grid grid-cols-1 gap-2.5">
            {bd.business && <BreakdownDetail label="Business Strength" breakdown={bd.business} />}
            {bd.financial && <BreakdownDetail label="Financial Health" breakdown={bd.financial} />}
            {bd.valuation && <BreakdownDetail label="Valuation" breakdown={bd.valuation} />}
            {bd.news && <BreakdownDetail label="News & Macro" breakdown={bd.news} />}
            {bd.risk && <BreakdownDetail label="Risk Profile" breakdown={bd.risk} />}
          </div>
        </div>
      )}
    </section>
  );
}
