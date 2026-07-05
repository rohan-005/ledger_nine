"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ResearchSummary,
  ResearchStatusResponse,
  EvidenceItem,
  AgentRun,
  Contradiction,
  parseScore,
  DecisionType,
} from "@/src/types/frontend";
import {
  getResearch,
  getResearchStatus,
  getResearchEvidence,
  getResearchAgents,
  getResearchContradictions,
} from "@/src/lib/api/research";
import ScoreOverview from "@/src/components/research/score-overview";
import CommitteeReport from "@/src/components/research/committee-report";
import EvidenceExplorer from "@/src/components/research/evidence-explorer";
import ContradictionList from "@/src/components/research/contradiction-list";
import AgentRunsPanel from "@/src/components/research/agent-runs";
import ResearchStatusPanel from "@/src/components/research/research-status";

// ─── Node labels ─────────────────────────────────────────────────────────────

const NODE_LABELS: Record<string, string> = {
  specialists: "Specialist Agents Running",
  contradictions: "Detecting Contradictions",
  scoring: "Computing Score",
  committee: "Writing Committee Report",
};

function nodeLabel(node: string | null): string {
  if (!node) return "Initializing…";
  return NODE_LABELS[node] ?? node;
}

// ─── Section nav ─────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "scores", label: "Scores" },
  { id: "report", label: "Committee Report" },
  { id: "evidence", label: "Evidence" },
  { id: "contradictions", label: "Contradictions" },
  { id: "agents", label: "Agent Runs" },
];

// ─── Header ──────────────────────────────────────────────────────────────────

function ResearchHeader({
  summary,
}: {
  summary: ResearchSummary;
}) {
  const { run, score } = summary;
  const finalScore = score ? parseScore(score.finalScore) : null;
  const decision: DecisionType | null = score?.decision ?? null;

  return (
    <div id="overview" className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4">
      {/* Metadata */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-400">
        <span>
          Horizon:{" "}
          <span className="text-neutral-200 font-medium">{run.investmentHorizon}</span>
        </span>
        <span>
          Risk:{" "}
          <span className="text-neutral-200 font-medium capitalize">{run.riskTolerance}</span>
        </span>
        <span>
          Status:{" "}
          <span className="text-neutral-200 font-medium uppercase">{run.status}</span>
        </span>
        {run.completedAt && (
          <span>
            Completed:{" "}
            <span className="text-neutral-200 font-medium">
              {new Date(run.completedAt).toLocaleString()}
            </span>
          </span>
        )}
      </div>

      {/* Ticker & Decision */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-0.5">Ticker</p>
          <h1 className="text-5xl font-bold font-mono text-neutral-100 leading-none">{run.ticker}</h1>
          {run.companyName && (
            <p className="text-neutral-400 text-base mt-1">{run.companyName}</p>
          )}
        </div>

        {decision !== null && finalScore !== null && (
          <div className="ml-auto text-right">
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-0.5">
              Deterministic Decision
            </p>
            <p
              className={`text-4xl font-black tracking-tight ${
                decision === "INVEST" ? "text-green-400" : "text-red-400"
              }`}
            >
              {decision}
            </p>
            <p className="text-2xl font-bold text-neutral-300 font-mono mt-0.5">
              {finalScore.toFixed(2)} / 100
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface ResearchPageClientProps {
  id: string;
}

export default function ResearchPageClient({ id }: ResearchPageClientProps) {
  const [summary, setSummary] = useState<ResearchSummary | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[] | null>(null);
  const [agents, setAgents] = useState<AgentRun[] | null>(null);
  const [contradictions, setContradictions] = useState<Contradiction[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartRef = useRef<number>(Date.now());
  const isPollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Load all detail data after completion
  const loadDetailData = useCallback(async (currentSummary: ResearchSummary) => {
    const ctrl = new AbortController();
    try {
      const [evRes, agRes, ctRes] = await Promise.all([
        getResearchEvidence(id, ctrl.signal),
        getResearchAgents(id, ctrl.signal),
        getResearchContradictions(id, ctrl.signal),
      ]);
      setEvidence(evRes.evidence);
      setAgents(agRes.agentRuns);
      setContradictions(ctRes.contradictions);
    } catch {
      // Non-fatal: detail data load failed; summary still available
    }
    setSummary(currentSummary);
    setLoading(false);
  }, [id]);

  // Poll status during active runs
  const pollStatus = useCallback(async () => {
    if (!isPollingRef.current) return;

    // Check timeout
    if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
      stopPolling();
      setPollTimedOut(true);
      setLoading(false);
      return;
    }

    let statusData: ResearchStatusResponse | null = null;
    try {
      statusData = await getResearchStatus(id);
    } catch {
      // Temporary failure — keep polling
    }

    if (!isPollingRef.current) return; // Unmounted during await

    if (statusData) {
      // Update in-place while keeping other fields
      setSummary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          run: {
            ...prev.run,
            status: statusData!.status,
            currentNode: statusData!.currentNode,
            errorMessage: statusData!.errorMessage,
            companyName: statusData!.companyName ?? prev.run.companyName,
            completedAt: statusData!.completedAt,
          },
        };
      });

      if (statusData.status === "completed") {
        stopPolling();
        // Re-fetch full summary to get scores + report
        try {
          const fresh = await getResearch(id);
          await loadDetailData(fresh);
        } catch {
          setLoading(false);
        }
        return;
      }

      if (statusData.status === "failed") {
        stopPolling();
        setLoading(false);
        return;
      }
    }

    // Schedule next poll
    if (isPollingRef.current) {
      pollingRef.current = setTimeout(pollStatus, POLL_INTERVAL_MS);
    }
  }, [id, stopPolling, loadDetailData]);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const data = await getResearch(id);
        if (cancelled) return;

        if (data.run.status === "completed") {
          await loadDetailData(data);
        } else if (data.run.status === "failed") {
          setSummary(data);
          setLoading(false);
        } else {
          // queued or running — start polling
          setSummary(data);
          setLoading(false);
          isPollingRef.current = true;
          pollStartRef.current = Date.now();
          pollingRef.current = setTimeout(pollStatus, POLL_INTERVAL_MS);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = (err as { error?: string })?.error ?? "Failed to load research run.";
        setError(msg);
        setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [id, loadDetailData, pollStatus, stopPolling]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading && !summary) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-neutral-400">
        <div className="w-6 h-6 border-2 border-neutral-500 border-t-white rounded-full animate-spin" />
        <p className="text-sm">Loading research run…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <p className="text-red-400 font-semibold">Unable to load research</p>
        <p className="text-sm text-neutral-500 max-w-md text-center">{error}</p>
        <a href="/research/new" className="text-sm text-blue-400 underline mt-2">
          Start a new research run →
        </a>
      </div>
    );
  }

  if (!summary) return null;

  const { run } = summary;
  const isActive = run.status === "queued" || run.status === "running";

  if (isActive || run.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        {pollTimedOut && (
          <div className="bg-amber-950/30 border border-amber-800 text-amber-200 text-sm rounded p-3 mb-2 max-w-lg text-center">
            Research is taking longer than expected. The backend may still be running — try refreshing in a minute.
          </div>
        )}
        <ResearchStatusPanel
          status={run.status}
          currentNode={run.currentNode}
          errorMessage={run.errorMessage}
          ticker={run.ticker}
        />
        {isActive && (
          <p className="text-xs text-neutral-600">
            {nodeLabel(run.currentNode)} · Polling every 2.5 s…
          </p>
        )}
      </div>
    );
  }

  // ── Completed dashboard ────────────────────────────────────────────────────

  const evidenceMap = new Map((evidence ?? []).map((e) => [e.id, e]));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Section nav */}
      <nav aria-label="Page sections" className="sticky top-0 z-10 bg-black/80 backdrop-blur border-b border-neutral-800 -mx-4 px-4 py-2">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="whitespace-nowrap text-sm text-neutral-400 hover:text-neutral-100 transition-colors focus:outline-none focus:underline"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Header / Overview */}
      <ResearchHeader summary={summary} />

      {/* Scores */}
      {summary.score && <ScoreOverview score={summary.score} />}

      {/* Committee Report */}
      {summary.report && <CommitteeReport report={summary.report} />}

      {/* Evidence */}
      {evidence !== null && <EvidenceExplorer evidence={evidence} />}
      {evidence === null && (
        <div className="text-sm text-neutral-500">Loading evidence…</div>
      )}

      {/* Contradictions */}
      {contradictions !== null && (
        <ContradictionList contradictions={contradictions} evidenceMap={evidenceMap} />
      )}

      {/* Agent Runs */}
      {agents !== null && <AgentRunsPanel agentRuns={agents} />}
    </div>
  );
}
