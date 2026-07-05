"use client";

import React from "react";
import { AgentRun } from "@/src/types/frontend";
import { Card } from "@/src/components/ui/card";
import { Tooltip } from "@/src/components/ui/tooltip";

const AGENT_LABELS: Record<string, string> = {
  earningsAgent: "Earnings Specialist",
  financialAgent: "Financial Health Specialist",
  macroAgent: "News & Macro Auditor",
  secAgent: "SEC Auditor",
  orchestrator: "Coordinating Orchestrator",
  contradictionDetector: "Fact Reconciliation Auditor",
  evidenceAuditor: "Quality Assurance Auditor",
  committeeAgent: "Investment Committee Panel",
};

function agentLabel(agentId: string): string {
  return AGENT_LABELS[agentId] ?? agentId;
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "completed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : status === "failed"
      ? "bg-red-50 text-red-700 border-red-150"
      : "bg-amber-50 text-amber-700 border-amber-150";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border capitalize ${classes}`}>
      {status}
    </span>
  );
}

export default function AgentRunsPanel({ agentRuns }: { agentRuns: AgentRun[] }) {
  if (agentRuns.length === 0) {
    return (
      <section id="agents" aria-labelledby="agents-heading" className="space-y-4">
        <h2 id="agents-heading" className="text-xl font-bold text-foreground border-b border-border pb-2">
          Research Team logs
        </h2>
        <p className="text-sm text-foreground-secondary py-4 text-center bg-white border border-border rounded-xl">
          No agent execution logs available.
        </p>
      </section>
    );
  }

  return (
    <section id="agents" aria-labelledby="agents-heading" className="space-y-6">
      <div className="border-b border-border pb-2 flex items-center justify-between">
        <h2 id="agents-heading" className="text-xl font-bold text-foreground">
          Research Team logs
        </h2>
        <span className="text-xs font-bold px-2 py-0.5 bg-background border border-border text-foreground-secondary rounded-md">
          {agentRuns.length} agents executed
        </span>
      </div>

      <p className="text-sm text-foreground-secondary max-w-2xl leading-relaxed">
        The table below shows the execution status of our specialized agent pipeline. Each agent extracts metrics from different databases, cross-references reports, and submits structured evidence.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-xs">
        <table className="w-full text-sm min-w-[640px] divide-y divide-border">
          <thead className="bg-surface-hover text-foreground-secondary text-xs uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-5 py-3.5 text-left">Research Agent</th>
              <th className="px-5 py-3.5 text-left">Status</th>
              <th className="px-5 py-3.5 text-left">AI Model info</th>
              <th className="px-5 py-3.5 text-left">Auditing latency</th>
              <th className="px-5 py-3.5 text-left">Fallback used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agentRuns.map((run) => (
              <tr key={run.id} className="hover:bg-surface-hover/30 transition-colors">
                <td className="px-5 py-4 font-bold text-foreground">
                  {agentLabel(run.agentId)}
                  <p className="text-[10px] text-foreground-muted font-mono font-normal">
                    ID: {run.agentId}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-5 py-4 font-mono text-xs text-foreground-secondary">
                  {run.provider ? (
                    <div>
                      <span className="capitalize">{run.provider}</span>
                      {run.model && <span className="text-foreground-muted"> · {run.model}</span>}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-4 font-mono text-xs text-foreground-secondary">
                  {run.latencyMs != null ? `${(run.latencyMs / 1000).toFixed(2)}s` : "—"}
                </td>
                <td className="px-5 py-4">
                  {run.fallbackUsed ? (
                    <div className="space-y-0.5">
                      <span className="text-amber-600 font-bold text-xs">Yes</span>
                      {run.fallbackReason && (
                        <p className="text-foreground-muted text-[11px] max-w-xs truncate" title={run.fallbackReason}>
                          {run.fallbackReason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-foreground-muted text-xs">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
