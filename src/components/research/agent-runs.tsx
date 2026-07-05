import { AgentRun } from "@/src/types/frontend";

const AGENT_LABELS: Record<string, string> = {
  earningsAgent: "Earnings Analysis",
  financialAgent: "Financial Analysis",
  macroAgent: "News & Macro",
  secAgent: "SEC Filing Analysis",
  orchestrator: "Agent Orchestrator",
  contradictionDetector: "Contradiction Detector",
  evidenceAuditor: "Evidence Auditor",
  committeeAgent: "Investment Committee",
};

function agentLabel(agentId: string): string {
  return AGENT_LABELS[agentId] ?? agentId;
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "completed"
      ? "bg-green-900/50 text-green-300 border-green-800"
      : status === "failed"
      ? "bg-red-900/50 text-red-300 border-red-800"
      : "bg-yellow-900/50 text-yellow-300 border-yellow-800";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${classes}`}>
      {status}
    </span>
  );
}

export default function AgentRunsPanel({ agentRuns }: { agentRuns: AgentRun[] }) {
  if (agentRuns.length === 0) {
    return (
      <section id="agents" aria-labelledby="agents-heading" className="space-y-4">
        <h2 id="agents-heading" className="text-lg font-bold text-neutral-100 border-b border-neutral-800 pb-2">
          Agent Execution Log
        </h2>
        <p className="text-sm text-neutral-500">No agent run records available.</p>
      </section>
    );
  }

  return (
    <section id="agents" aria-labelledby="agents-heading" className="space-y-4">
      <h2 id="agents-heading" className="text-lg font-bold text-neutral-100 border-b border-neutral-800 pb-2">
        Agent Execution Log
      </h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Agent</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Provider</th>
              <th className="px-4 py-2 text-left font-medium">Model</th>
              <th className="px-4 py-2 text-left font-medium">Latency</th>
              <th className="px-4 py-2 text-left font-medium">Fallback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {agentRuns.map((run) => (
              <tr key={run.id} className="bg-neutral-950 hover:bg-neutral-900 transition-colors">
                <td className="px-4 py-3 font-medium text-neutral-100">{agentLabel(run.agentId)}</td>
                <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                <td className="px-4 py-3 text-neutral-400 font-mono text-xs">{run.provider ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-400 font-mono text-xs">{run.model ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-400 font-mono text-xs">
                  {run.latencyMs != null ? `${run.latencyMs} ms` : "—"}
                </td>
                <td className="px-4 py-3">
                  {run.fallbackUsed ? (
                    <div className="space-y-0.5">
                      <span className="text-amber-400 font-medium text-xs">Yes</span>
                      {run.fallbackReason && (
                        <p className="text-neutral-500 text-xs max-w-xs truncate" title={run.fallbackReason}>
                          {run.fallbackReason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-neutral-600 text-xs">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
