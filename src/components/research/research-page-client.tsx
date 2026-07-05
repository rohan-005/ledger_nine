"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

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

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "scores", label: "Scores" },
  { id: "report", label: "Committee Report" },
  { id: "evidence", label: "Evidence" },
  { id: "contradictions", label: "Contradictions" },
  { id: "agents", label: "Agent Runs" },
];

// ─── Result header ────────────────────────────────────────────────────────────

function ResearchHeader({ summary }: { summary: ResearchSummary }) {
  const { run, score } = summary;
  const finalScore = score ? parseScore(score.finalScore) : null;
  const decision: DecisionType | null = score?.decision ?? null;

  return (
    <div id="overview" className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-400">
        <span>Horizon: <span className="text-neutral-200 font-medium">{run.investmentHorizon}</span></span>
        <span>Risk: <span className="text-neutral-200 font-medium capitalize">{run.riskTolerance}</span></span>
        <span>Status: <span className="text-neutral-200 font-medium uppercase">{run.status}</span></span>
        {run.completedAt && (
          <span>Completed: <span className="text-neutral-200 font-medium">{new Date(run.completedAt).toLocaleString()}</span></span>
        )}
      </div>

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
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-0.5">Deterministic Decision</p>
            <p className={`text-4xl font-black tracking-tight ${decision === "INVEST" ? "text-green-400" : "text-red-400"}`}>
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function ResearchPageClient({ id }: { id: string }) {
  const [summary, setSummary] = useState<ResearchSummary | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[] | null>(null);
  const [agents, setAgents] = useState<AgentRun[] | null>(null);
  const [contradictions, setContradictions] = useState<Contradiction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  // All polling state lives in refs to avoid stale closure issues
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const pollStartRef = useRef(0);
  const isPollingRef = useRef(false);

  function stopPolling() {
    isPollingRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  async function loadDetailData(currentSummary: ResearchSummary) {
    try {
      const [evRes, agRes, ctRes] = await Promise.all([
        getResearchEvidence(id),
        getResearchAgents(id),
        getResearchContradictions(id),
      ]);
      if (!mountedRef.current) return;
      setEvidence(evRes.evidence);
      setAgents(agRes.agentRuns);
      setContradictions(ctRes.contradictions);
    } catch {
      // non-fatal
    }
    if (!mountedRef.current) return;
    setSummary(currentSummary);
    setLoading(false);
  }

  function schedulePoll(pollFn: () => void) {
    timerRef.current = setTimeout(pollFn, POLL_INTERVAL_MS);
  }

  useEffect(() => {
    mountedRef.current = true;

    async function poll() {
      if (!isPollingRef.current || !mountedRef.current) return;

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
        // temporary failure — keep polling
      }

      if (!isPollingRef.current || !mountedRef.current) return;

      if (statusData) {
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
          try {
            const fresh = await getResearch(id);
            if (mountedRef.current) await loadDetailData(fresh);
          } catch {
            if (mountedRef.current) setLoading(false);
          }
          return;
        }

        if (statusData.status === "failed") {
          stopPolling();
          setLoading(false);
          return;
        }
      }

      if (isPollingRef.current) schedulePoll(poll);
    }

    async function init() {
      try {
        const data = await getResearch(id);
        if (!mountedRef.current) return;

        if (data.run.status === "completed") {
          await loadDetailData(data);
        } else if (data.run.status === "failed") {
          setSummary(data);
          setLoading(false);
        } else {
          setSummary(data);
          setLoading(false);
          isPollingRef.current = true;
          pollStartRef.current = Date.now();
          schedulePoll(poll);
        }
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        const msg = (err as { error?: string })?.error ?? "Failed to load research run.";
        setError(msg);
        setLoading(false);
      }
    }

    init();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Render ────────────────────────────────────────────────────────────────

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
        <Link href="/research/new" className="text-sm text-blue-400 underline mt-2">
          Start a new research run →
        </Link>
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

  // ── Completed dashboard ──────────────────────────────────────────────────

  const evidenceMap = new Map((evidence ?? []).map((e) => [e.id, e]));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
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

      <ResearchHeader summary={summary} />
      {summary.score && <ScoreOverview score={summary.score} />}
      {summary.report && <CommitteeReport report={summary.report} />}
      {evidence !== null
        ? <EvidenceExplorer evidence={evidence} />
        : <div className="text-sm text-neutral-500">Loading evidence…</div>
      }
      {contradictions !== null && (
        <ContradictionList contradictions={contradictions} evidenceMap={evidenceMap} />
      )}
      {agents !== null && <AgentRunsPanel agentRuns={agents} />}
    </div>
  );
}
