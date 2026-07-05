"use client";

import React from "react";
import { AgentRun } from "@/src/types/frontend";
import { Card } from "@/src/components/ui/card";
import { Tooltip } from "@/src/components/ui/tooltip";

const RESEARCH_AREAS = [
  { id: "financial", label: "Financial statements" },
  { id: "sec", label: "Regulatory filings" },
  { id: "macro", label: "Market context" },
  { id: "earnings", label: "Earnings commentary" },
];

export default function AgentRunsPanel({ agentRuns }: { agentRuns: AgentRun[] }) {
  if (agentRuns.length === 0) {
    return (
      <section id="agents" aria-labelledby="agents-heading" className="space-y-4">
        <h2 id="agents-heading" className="text-xl font-bold text-foreground border-b border-border pb-2">
          Research Checks
        </h2>
        <p className="text-sm text-foreground-secondary py-4 text-center bg-white border border-border rounded-xl">
          No research checks available.
        </p>
      </section>
    );
  }

  return (
    <section id="agents" aria-labelledby="agents-heading" className="space-y-6">
      <div className="border-b border-border pb-2 flex items-center justify-between">
        <h2 id="agents-heading" className="text-xl font-bold text-foreground">
          Research Checks
        </h2>
        <span className="text-xs font-bold px-2 py-0.5 bg-background border border-border text-foreground-secondary rounded-md">
          {agentRuns.length} research checks attempted
        </span>
      </div>

      <p className="text-sm text-foreground-secondary max-w-2xl leading-relaxed">
        The status below shows the progress of our specialized research audits. Each area verifies distinct datasets and cross-references them to build a reliable fact basis.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {RESEARCH_AREAS.map((area) => {
          const run = agentRuns.find((r) => r.agentId === area.id);
          const status = run?.status === "completed" ? "Completed" : run?.status === "skipped" ? "Skipped" : "Unavailable";
          const statusColor = status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : status === "Skipped" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-red-50 text-red-700 border-red-100";
          return (
            <div key={area.id} className="flex items-center justify-between p-4 bg-white border border-border rounded-xl shadow-xs">
              <span className="font-semibold text-foreground text-sm">{area.label}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${statusColor}`}>
                {status}
              </span>
            </div>
          );
        })}
      </div>

      {/* Technical developer logs disclosure */}
      <details className="border border-border rounded-xl bg-white group transition-all overflow-hidden">
        <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none text-xs font-bold text-foreground-secondary hover:bg-surface-hover list-none uppercase tracking-wider">
          <span>⚙️ Technical details (Developer logs)</span>
          <span className="text-foreground-secondary group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-5 pb-5 pt-3 space-y-4 text-xs font-mono text-foreground-secondary border-t border-border bg-surface-hover/20 max-h-96 overflow-y-auto">
          {agentRuns.map((run) => (
            <div key={`tech-${run.id}`} className="space-y-1.5 pb-3 border-b border-border/50 last:border-0 last:pb-0">
              <p className="font-bold text-foreground">{run.agentId} ({run.status})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-foreground-secondary">
                <span>Latency: {run.latencyMs ?? "—"} ms</span>
                <span>Model: {run.provider ?? "—"} ({run.model ?? "—"})</span>
                <span>Started: {run.startedAt ? new Date(run.startedAt).toISOString() : "—"}</span>
                <span>Completed: {run.completedAt ? new Date(run.completedAt).toISOString() : "—"}</span>
              </div>
              {run.errorMessage && (
                <div className="mt-1">
                  <p className="text-[10px] text-red-650 font-bold mb-0.5">Error Message:</p>
                  <pre className="p-2.5 bg-red-50 border border-red-100 text-red-800 rounded-lg text-[10px] whitespace-pre-wrap overflow-x-auto leading-relaxed">
                    {run.errorMessage}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
