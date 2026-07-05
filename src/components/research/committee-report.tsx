"use client";

import React from "react";
import { CommitteeReport as CommitteeReportType } from "@/src/types/frontend";
import { Card } from "@/src/components/ui/card";
import { Tooltip } from "@/src/components/ui/tooltip";

interface CommitteeReportProps {
  report: CommitteeReportType;
}

export default function CommitteeReport({ report }: CommitteeReportProps) {
  if (!report || (report.thesis === "" && report.summary === "")) {
    return (
      <section id="report" aria-labelledby="report-heading" className="space-y-6">
        <div className="border-b border-border pb-2 flex items-center justify-between">
          <h2 id="report-heading" className="text-xl font-bold text-foreground">
            Thesis Narrative
          </h2>
          <span className="text-xs text-foreground-secondary font-medium">
            Unavailable
          </span>
        </div>
        <div className="bg-amber-50/50 border border-amber-200 text-amber-800 rounded-xl p-5 text-sm leading-relaxed">
          ⚠️ <strong>Narrative Synthesis Degraded:</strong> The AI Investment Committee report is unavailable for this run. Raw analytical scores and individual evidence details are fully preserved.
        </div>
      </section>
    );
  }

  return (
    <section id="report" aria-labelledby="report-heading" className="space-y-6">
      <div className="border-b border-border pb-2 flex items-center justify-between">
        <h2 id="report-heading" className="text-xl font-bold text-foreground">
          Investment Narrative
        </h2>
        <span className="text-xs text-foreground-secondary font-medium">
          Synthesized by Investment Committee
        </span>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-800 leading-relaxed">
        ℹ️ <strong>Committee Synthesis:</strong> This qualitative narrative is synthesized from the raw evidence pool.
        Note that the final rating score and investment verdict are calculated <strong>deterministically</strong>
        by the scoring engine, not by this narrative.
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Thesis & Executive Summary */}
        <Card className="space-y-4">
          <div>
            <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-2">
              <Tooltip content="The core qualitative argument supporting the investment outcome.">
                Investment Thesis
              </Tooltip>
            </h3>
            <p className="text-base text-foreground font-semibold leading-relaxed">
              {report.thesis}
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-2">
              Executive Summary
            </h3>
            <p className="text-sm text-foreground-secondary leading-relaxed">
              {report.summary}
            </p>
          </div>
        </Card>

        {/* Highlights: Strengths & Concerns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bull Case */}
          <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold">
                ✓
              </span>
              <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">
                Case Highlights (Bull Case)
              </h3>
            </div>
            <ul className="space-y-3">
              {report.bullCase.map((point, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-foreground-secondary leading-relaxed">
                  <span className="text-emerald-600 font-bold mt-0.5 select-none shrink-0">+</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bear Case */}
          <div className="bg-red-50/20 border border-red-100/60 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-800 text-sm font-bold">
                ✕
              </span>
              <h3 className="text-sm font-bold text-red-900 uppercase tracking-wider">
                Negative Signals (Bear Case)
              </h3>
            </div>
            <ul className="space-y-3">
              {report.bearCase.map((point, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-foreground-secondary leading-relaxed">
                  <span className="text-red-500 font-bold mt-0.5 select-none shrink-0">−</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Key Risks */}
        {report.keyRisks.length > 0 && (
          <div className="bg-amber-50/30 border border-amber-100/70 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-sm font-bold">
                ⚠️
              </span>
              <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
                Key Risks to Monitor
              </h3>
            </div>
            <ul className="space-y-2.5">
              {report.keyRisks.map((risk, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-foreground-secondary leading-relaxed">
                  <span className="text-amber-600 font-bold shrink-0">•</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
