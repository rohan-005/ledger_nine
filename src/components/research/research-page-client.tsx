"use client";

import React, { useState, useEffect, useRef } from "react";
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
import VerdictCard from "@/src/components/research/verdict-card";
import InvestmentCaseOverview from "@/src/components/research/investment-case-overview";
import ScoreOverview from "@/src/components/research/score-overview";
import CommitteeReport from "@/src/components/research/committee-report";
import EvidenceExplorer from "@/src/components/research/evidence-explorer";
import ContradictionList from "@/src/components/research/contradiction-list";
import AgentRunsPanel from "@/src/components/research/agent-runs";
import ResearchStatusPanel from "./research-status";

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
  { id: "overview", label: "Overview Verdict" },
  { id: "scores", label: "Analytical Scores" },
  { id: "report", label: "Thesis Narrative" },
  { id: "evidence", label: "Sources & Evidence" },
  { id: "contradictions", label: "Contradiction Audit" },
  { id: "agents", label: "Research Team Logs" },
];

// ─── Redesigned Light Header Hero ──────────────────────────────────────────────

function ResearchHeader({ summary }: { summary: ResearchSummary }) {
  const { run } = summary;

  return (
    <div className="bg-white border border-border rounded-2xl p-6 md:p-8 space-y-4 shadow-xs">
      <div className="flex flex-wrap gap-3 text-xs font-bold text-foreground-secondary items-center">
        <span className="bg-background border border-border px-3 py-1 rounded-lg">
          Horizon: <span className="text-foreground">{run.investmentHorizon}</span>
        </span>
        <span className="bg-background border border-border px-3 py-1 rounded-lg capitalize">
          Risk: <span className="text-foreground">{run.riskTolerance}</span>
        </span>
        <span className="bg-background border border-border px-3 py-1 rounded-lg uppercase">
          Status: <span className="text-foreground">{run.status}</span>
        </span>
        {run.completedAt && (
          <span className="text-foreground-muted font-normal ml-auto">
            {run.status === "interrupted" ? "Research Interrupted: " : "Run Completed: "}
            {new Date(run.completedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="border-t border-border/60 pt-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest">
            Investigated Asset
          </span>
          <h1 className="text-4xl sm:text-5xl font-black font-mono text-foreground leading-none tracking-tight">
            {run.ticker}
          </h1>
          {run.companyName && (
            <p className="text-foreground-secondary text-lg mt-1 font-semibold">
              {run.companyName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main client component ─────────────────────────────────────────────────────

export default function ResearchPageClient({ id }: { id: string }) {
  const [summary, setSummary] = useState<ResearchSummary | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[] | null>(null);
  const [agents, setAgents] = useState<AgentRun[] | null>(null);
  const [contradictions, setContradictions] = useState<Contradiction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

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
      // non-fatal detail fetch failures
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
        // Keep polling on transient API errors
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

  if (loading && !summary) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-foreground-secondary">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading investment research summary…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-red-600 font-bold text-lg">Unable to load research</p>
        <p className="text-sm text-foreground-secondary max-w-md text-center">{error}</p>
        <Link href="/research/new" className="text-sm text-blue-600 font-semibold underline mt-2">
          Start a new research run →
        </Link>
      </div>
    );
  }

  if (!summary) return null;

  const { run, score } = summary;
  const isActive = run.status === "queued" || run.status === "running";

  if (isActive || run.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        {pollTimedOut && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3 mb-2 max-w-lg text-center font-medium leading-relaxed shadow-xs">
            ⚠️ Research is taking longer than expected. The pipeline continues executing in the background. Please wait or refresh the page.
          </div>
        )}
        <ResearchStatusPanel
          status={run.status}
          currentNode={run.currentNode}
          errorMessage={run.errorMessage}
          ticker={run.ticker}
        />
        {isActive && (
          <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">
            Current stage: {nodeLabel(run.currentNode)} · polling pipeline status…
          </p>
        )}
      </div>
    );
  }

  const showDetailedResults =
    run.status === "completed" &&
    run.outcome !== "provider_failure" &&
    run.outcome !== "partial" &&
    run.outcome !== "interrupted" &&
    run.outcome !== "insufficient_evidence" &&
    run.outcome !== "asset_unresolved" &&
    run.outcome !== "failed";

  const finalScore = score ? parseScore(score.finalScore) : 0;
  const confidence = score ? parseScore(score.evidenceQuality) : 0;
  const decision: DecisionType = score?.decision ?? "PASS";

  const evidenceMap = new Map((evidence ?? []).map((e) => [e.id, e]));

  // Build warning banner based on outcome
  let warningBanner = null;
  if (run.outcome === "asset_unresolved") {
    warningBanner = (
      <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-6 md:p-8 space-y-4 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-2xl select-none">⚠️</span>
          <h2 className="text-lg font-bold">Asset Unresolved</h2>
        </div>
        <p className="text-sm text-red-800 leading-relaxed">
          The research pipeline could not verify the company identifier or ticker symbol <strong>{run.ticker}</strong>. Please check that the ticker symbol is correct and active.
        </p>
        {run.researchLimitations && run.researchLimitations.length > 0 && (
          <div className="border-t border-red-200 pt-3 space-y-2">
            <p className="text-xs font-bold text-red-900 uppercase tracking-wider">Research Limitations</p>
            <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
              {run.researchLimitations.map((limit: string, idx: number) => (
                <li key={idx}>{limit}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  } else if (run.outcome === "insufficient_evidence") {
    warningBanner = (
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-6 md:p-8 space-y-4 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-2xl select-none">⚠️</span>
          <h2 className="text-lg font-bold">Research Insufficient</h2>
        </div>
        <p className="text-sm text-amber-800 leading-relaxed">
          We were unable to collect sufficient factual evidence to calculate a rating score or produce an investment thesis for <strong>{run.ticker}</strong>.
        </p>
        {run.insufficiencyReasons && run.insufficiencyReasons.length > 0 && (
          <div className="border-t border-amber-200 pt-3 space-y-2">
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Identified Insufficiency Factors</p>
            <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
              {run.insufficiencyReasons.map((reason: string, idx: number) => {
                if (reason === "NO_EVIDENCE") return <li key={idx}>No evidence was gathered from any source.</li>;
                if (reason === "NO_FINANCIAL_EVIDENCE") return <li key={idx}>Missing fundamental financial or financial statements data.</li>;
                if (reason === "INSUFFICIENT_CATEGORY_COVERAGE") return <li key={idx}>Insufficient coverage across different analysis categories.</li>;
                if (reason === "CRITICAL_AGENT_FAILURES") return <li key={idx}>A critical agent failed during execution.</li>;
                if (reason === "INSUFFICIENT_SPECIALIST_COVERAGE") return <li key={idx}>Completed specialist checks were insufficient to fulfill coverage gates (at least 2 successful agents required).</li>;
                if (reason === "INSUFFICIENT_SOURCE_DIVERSITY") return <li key={idx}>Failed to establish diverse data source provenance (at least 2 unique source types required).</li>;
                if (reason === "NO_REGULATORY_EVIDENCE") return <li key={idx}>Regulatory filings (SEC) required for US assets could not be retrieved.</li>;
                return <li key={idx}>{reason}</li>;
              })}
            </ul>
          </div>
        )}
        {run.researchLimitations && run.researchLimitations.length > 0 && (
          <div className="border-t border-amber-200 pt-3 space-y-2">
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Research Limitations</p>
            <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
              {run.researchLimitations.map((limit: string, idx: number) => (
                <li key={idx}>{limit}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  } else if (run.status === "interrupted" || run.outcome === "provider_failure" || run.outcome === "partial" || run.outcome === "interrupted") {
    warningBanner = (
      <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-6 md:p-8 space-y-4 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-2xl select-none">⚠️</span>
          <h2 className="text-lg font-bold">Research Interrupted</h2>
        </div>
        <p className="text-sm font-bold text-rose-800">
          The audit was stopped. We did not formulate a rating.
        </p>
        <p className="text-sm text-rose-850 leading-relaxed">
          The research run did not complete successfully due to service limitations or data execution failures. No final scores or ratings could be calculated.
        </p>
        {run.researchLimitations && run.researchLimitations.length > 0 && (
          <div className="border-t border-rose-200 pt-3 space-y-2">
            <p className="text-xs font-bold text-rose-900 uppercase tracking-wider">Research Limitations</p>
            <ul className="text-xs text-rose-800 space-y-1 list-disc list-inside">
              {run.researchLimitations.map((limit: string, idx: number) => (
                <li key={idx}>{limit}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Filter sections dynamically
  const activeSections = SECTIONS.filter((s) => {
    if (!showDetailedResults) {
      return s.id === "evidence" || s.id === "contradictions" || s.id === "agents";
    }
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Sticky Tab Navigation Bar */}
      <nav
        aria-label="Research sections"
        className="sticky top-0 z-10 bg-white/85 border-b border-border backdrop-blur-md -mx-4 px-4 py-3 flex gap-4 overflow-x-auto scrollbar-hide shadow-2xs"
      >
        <div className="flex gap-4 overflow-x-auto scrollbar-hide w-full max-w-5xl mx-auto">
          {activeSections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="whitespace-nowrap text-xs font-bold text-foreground-secondary hover:text-primary transition-colors focus:outline-none focus:underline"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Hero Info Header */}
      <ResearchHeader summary={summary} />

      {/* Warning Banner */}
      {warningBanner}

      {/* Hero Overview Verdict section */}
      {showDetailedResults && (
        <>
          <div id="overview" className="scroll-mt-20 space-y-6">
            <VerdictCard
              decision={decision}
              finalScore={finalScore}
              evidenceQuality={confidence}
            />
            {score && <InvestmentCaseOverview score={score} />}
          </div>

          {/* Analytical Scores Section */}
          <div id="scores" className="scroll-mt-20">
            {score && <ScoreOverview score={score} />}
          </div>

          {/* Investment Narrative / Committee Report */}
          <div id="report" className="scroll-mt-20">
            {summary.report && <CommitteeReport report={summary.report} />}
          </div>
        </>
      )}

      {/* Evidence Explorer */}
      {evidence && evidence.length > 0 && (
        <div id="evidence" className="scroll-mt-20">
          <EvidenceExplorer evidence={evidence} hideCharts={!showDetailedResults} />
        </div>
      )}

      {/* Contradiction Reconciliation Audit */}
      {contradictions && contradictions.length > 0 && (
        <div id="contradictions" className="scroll-mt-20">
          <ContradictionList contradictions={contradictions} evidenceMap={evidenceMap} />
        </div>
      )}

      {/* Research Team Agent Runs */}
      {agents && agents.length > 0 && (
        <div id="agents" className="scroll-mt-20">
          <AgentRunsPanel agentRuns={agents} />
        </div>
      )}

      {/* Global Footer */}
      <footer className="text-center text-xs text-foreground-muted border-t border-border/60 pt-8 mt-12 pb-6">
        <p>
          Where an investment assessment is produced, scoring follows deterministic rules. If research is interrupted, scores are withheld.
        </p>
      </footer>
    </div>
  );
}
