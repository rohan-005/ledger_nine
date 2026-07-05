import Link from "next/link";
import { ResearchStatus } from "@/src/types/frontend";

const NODE_LABELS: Record<string, string> = {
  specialists: "Running specialist agents (Business, Financial, Valuation, News, Risk)…",
  contradictions: "Auditing evidence for contradictions…",
  scoring: "Computing deterministic score…",
  committee: "Investment committee writing final report…",
};

const STATUS_PROGRESS: Record<string, number> = {
  queued: 5,
  specialists: 30,
  contradictions: 60,
  scoring: 80,
  committee: 92,
};

interface ResearchStatusProps {
  status: ResearchStatus;
  currentNode: string | null;
  errorMessage: string | null;
  ticker: string;
}

export default function ResearchStatusPanel({
  status,
  currentNode,
  errorMessage,
  ticker,
}: ResearchStatusProps) {
  const stepLabel =
    status === "queued"
      ? "Queued — waiting for pipeline…"
      : currentNode
      ? (NODE_LABELS[currentNode] ?? currentNode)
      : "Initializing…";

  const progress =
    status === "queued"
      ? STATUS_PROGRESS.queued
      : STATUS_PROGRESS[currentNode ?? ""] ?? 20;

  if (status === "failed") {
    return (
      <div className="w-full max-w-lg bg-neutral-900 border border-red-900/50 rounded-lg p-6 space-y-3">
        <h2 className="text-base font-bold text-red-400">Research Failed</h2>
        <p className="text-sm text-neutral-400">
          The pipeline could not complete the analysis for{" "}
          <span className="font-mono font-semibold text-neutral-200">{ticker}</span>.
        </p>
        {errorMessage && (
          <p className="text-sm text-neutral-500 border border-neutral-800 bg-neutral-950 rounded px-3 py-2 font-mono">
            {errorMessage}
          </p>
        )}
        <Link
          href="/research/new"
          className="inline-block text-sm text-blue-400 underline hover:text-blue-300 focus:outline-none"
        >
          Try a new research run →
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest font-mono mb-0.5">
            {status === "queued" ? "QUEUED" : "RUNNING"}
          </p>
          <h2 className="text-lg font-bold text-neutral-100">
            Analyzing{" "}
            <span className="font-mono">{ticker}</span>
          </h2>
        </div>
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin shrink-0" aria-hidden />
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-white h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Pipeline progress"
          />
        </div>
        <p className="text-xs text-neutral-400">{stepLabel}</p>
      </div>
    </div>
  );
}
