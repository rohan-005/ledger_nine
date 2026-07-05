"use client";

import React from "react";
import { getFriendlyVerdict } from "@/src/lib/presentation/helpers";
import { Card } from "@/src/components/ui/card";
import { Tooltip } from "@/src/components/ui/tooltip";

interface VerdictCardProps {
  decision: "INVEST" | "PASS";
  finalScore: number;
  evidenceQuality: number;
}

export default function VerdictCard({
  decision,
  finalScore,
  evidenceQuality,
}: VerdictCardProps) {
  const verdict = getFriendlyVerdict(decision, finalScore, evidenceQuality);

  return (
    <Card className={`border-2 ${verdict.border} ${verdict.bg} space-y-4`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
            Investment Verdict
          </p>
          <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${verdict.color}`}>
            {verdict.label}
          </h2>
          <p className="text-sm text-foreground-secondary leading-relaxed max-w-xl">
            {verdict.desc}
          </p>
        </div>

        <div className="flex items-center gap-6 shrink-0 sm:text-right">
          <div className="space-y-0.5">
            <p className="text-xs text-foreground-muted font-semibold uppercase tracking-wider">
              <Tooltip content="Weighted score computed by combining Business Strength, Financial Health, Valuation, News, and Risk Profile minus any contradiction penalties.">
                Overall Score
              </Tooltip>
            </p>
            <p className="text-3xl font-black text-foreground font-mono">
              {finalScore.toFixed(1)}
              <span className="text-sm text-foreground-muted font-normal">/100</span>
            </p>
          </div>

          <div className="space-y-0.5 border-l border-foreground-muted/20 pl-6 sm:border-l-0 sm:pl-0">
            <p className="text-xs text-foreground-muted font-semibold uppercase tracking-wider">
              <Tooltip content="The average confidence score across all gathered evidence. Higher means more verified and reliable sources.">
                Confidence
              </Tooltip>
            </p>
            <p className="text-3xl font-black text-foreground font-mono">
              {evidenceQuality.toFixed(0)}
              <span className="text-sm text-foreground-muted font-normal">%</span>
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-foreground-muted/10 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground-secondary">
        <div>
          Deterministic System Action:{" "}
          <span className={`font-mono font-bold uppercase px-2 py-0.5 rounded border ${
            decision === "INVEST"
              ? "bg-emerald-100/50 border-emerald-200 text-emerald-800"
              : "bg-red-100/50 border-red-200 text-red-800"
          }`}>
            {decision}
          </span>
        </div>
        <p className="text-foreground-muted italic">
          Scoring is purely mechanical and based on verified facts. No AI opinion involved.
        </p>
      </div>
    </Card>
  );
}
