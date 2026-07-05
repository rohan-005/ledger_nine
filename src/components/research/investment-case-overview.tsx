"use client";

import React from "react";
import { ResearchScores, parseScore } from "@/src/types/frontend";
import { getScoreBand } from "@/src/lib/presentation/helpers";
import { Card } from "@/src/components/ui/card";
import { Tooltip } from "@/src/components/ui/tooltip";

interface InvestmentCaseOverviewProps {
  score: ResearchScores;
}

const CATEGORY_LABELS: Record<string, string> = {
  business: "Business Quality",
  financial: "Financial Health",
  valuation: "Valuation",
  news: "News & Macro",
  risk: "Risk Profile",
};

export default function InvestmentCaseOverview({ score }: InvestmentCaseOverviewProps) {
  const categories = [
    score.business !== null ? { key: "business", val: parseScore(score.business), label: CATEGORY_LABELS.business } : null,
    score.financial !== null ? { key: "financial", val: parseScore(score.financial), label: CATEGORY_LABELS.financial } : null,
    score.valuation !== null ? { key: "valuation", val: parseScore(score.valuation), label: CATEGORY_LABELS.valuation } : null,
    score.news !== null ? { key: "news", val: parseScore(score.news), label: CATEGORY_LABELS.news } : null,
    score.risk !== null ? { key: "risk", val: parseScore(score.risk), label: CATEGORY_LABELS.risk } : null,
  ].filter((c): c is { key: string; val: number; label: string } => c !== null);

  if (categories.length === 0) {
    return null;
  }

  // Find strongest and weakest categories
  const sorted = [...categories].sort((a, b) => b.val - a.val);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  const overall = parseScore(score.finalScore);
  const confidence = parseScore(score.evidenceQuality);
  const penalty = parseScore(score.contradictionPenalty);

  const overallBand = getScoreBand(overall);
  const strongestBand = getScoreBand(strongest.val);
  const weakestBand = getScoreBand(weakest.val);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Case at a Glance */}
      <Card className="space-y-4">
        <h3 className="text-sm font-bold text-foreground-secondary uppercase tracking-wider">
          Case at a Glance
        </h3>
        
        <div className="divide-y divide-border">
          <div className="py-2.5 flex items-center justify-between text-sm">
            <span className="text-foreground-secondary font-medium">Strongest Area</span>
            <div className="text-right">
              <span className="font-semibold text-foreground mr-2">{strongest.label}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${strongestBand.bg} ${strongestBand.color} border ${strongestBand.border}`}>
                {strongestBand.label} ({strongest.val.toFixed(0)})
              </span>
            </div>
          </div>

          <div className="py-2.5 flex items-center justify-between text-sm">
            <span className="text-foreground-secondary font-medium">Biggest Concern</span>
            <div className="text-right">
              <span className="font-semibold text-foreground mr-2">{weakest.label}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${weakestBand.bg} ${weakestBand.color} border ${weakestBand.border}`}>
                {weakestBand.label} ({weakest.val.toFixed(0)})
              </span>
            </div>
          </div>

          <div className="py-2.5 flex items-center justify-between text-sm">
            <span className="text-foreground-secondary font-medium">Research Confidence</span>
            <span className="font-bold text-foreground font-mono">{confidence.toFixed(0)}%</span>
          </div>

          <div className="py-2.5 flex items-center justify-between text-sm">
            <span className="text-foreground-secondary font-medium">Overall Rating</span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${overallBand.bg} ${overallBand.color} border ${overallBand.border}`}>
              {overallBand.label} ({overall.toFixed(0)})
            </span>
          </div>
        </div>
      </Card>

      {/* Summary Narrative Card */}
      <Card className="flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground-secondary uppercase tracking-wider">
            Quick Take
          </h3>
          <p className="text-sm text-foreground leading-relaxed">
            This company is rated <strong className={overallBand.color}>{overallBand.label.toLowerCase()}</strong> with an overall score of <strong>{overall.toFixed(1)}/100</strong>.
            Its primary strength lies in its <span className="font-semibold">{strongest.label.toLowerCase()}</span>, which scored <strong>{strongest.val.toFixed(0)}</strong> ({strongestBand.label.toLowerCase()}).
            However, the main risk or concern is its <span className="font-semibold">{weakest.label.toLowerCase()}</span>, scoring <strong>{weakest.val.toFixed(0)}</strong> ({weakestBand.label.toLowerCase()}).
          </p>
          {penalty > 0 && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
              ⚠️ <strong>Contradiction Audit Notice:</strong> The final score was reduced by <strong>{penalty.toFixed(1)} points</strong> due to conflicting information detected across different evidence sources. Review the contradictions below.
            </p>
          )}
        </div>
        <p className="text-xs text-foreground-muted">
          * Descriptors and bands are mapped deterministically based on facts and findings.
        </p>
      </Card>
    </div>
  );
}
