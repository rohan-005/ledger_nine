"use client";

import React from "react";
import Link from "next/link";
import { ResearchStatus } from "@/src/types/frontend";

const NODE_LABELS: Record<string, string> = {
  specialists: "Running specialist agents to extract fundamental facts…",
  contradictions: "Auditing facts for mismatching claims and contradictions…",
  scoring: "Calculating final deterministic rating scores…",
  committee: "investment Committee panel drafting plain-English thesis summary…",
};

const STEPS = [
  { id: "specialists", label: "Evidence Gathering" },
  { id: "contradictions", label: "Contradiction Audit" },
  { id: "scoring", label: "Scoring Engine" },
  { id: "committee", label: "Committee Synthesis" },
];

function getStepIndex(node: string | null): number {
  if (!node) return -1;
  return STEPS.findIndex((s) => s.id === node);
}

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
  const stepIndex = getStepIndex(currentNode);
  const activeLabel = currentNode ? NODE_LABELS[currentNode] : "Initializing pipeline…";

  // Calculate progress percent
  let pct = 5;
  if (status === "running") {
    if (currentNode === "specialists") pct = 25;
    else if (currentNode === "contradictions") pct = 55;
    else if (currentNode === "scoring") pct = 75;
    else if (currentNode === "committee") pct = 90;
  }

  if (status === "failed") {
    return (
      <div className="w-full max-w-lg bg-white border border-red-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-700 text-lg font-bold">
            ✕
          </span>
          <div>
            <h2 className="text-base font-bold text-red-700">Research Pipeline Failed</h2>
            <p className="text-xs text-foreground-secondary">
              Unable to complete autonomous analysis for <strong className="font-mono">{ticker}</strong>
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 text-xs text-red-800 font-mono overflow-x-auto leading-relaxed">
            <strong>Error details:</strong>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        <div className="pt-2">
          <Link
            href="/research/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary-hover active:scale-[0.99] text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            Start a new research run
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg bg-white border border-border rounded-2xl p-6 space-y-6 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wide">
            {status}
          </span>
          <h2 className="text-lg font-extrabold text-foreground tracking-tight">
            Researching <span className="font-mono text-primary">{ticker}</span>
          </h2>
        </div>
        <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin shrink-0" aria-hidden />
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="w-full bg-background border border-border h-2 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Research pipeline progress"
          />
        </div>
        <p className="text-xs text-foreground-secondary font-medium leading-relaxed">
          {activeLabel}
        </p>
      </div>

      {/* Stepper View */}
      <div className="border-t border-border/60 pt-4 space-y-3">
        <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">
          Pipeline Audit Steps
        </p>
        <div className="space-y-2">
          {STEPS.map((s, idx) => {
            const isCompleted = stepIndex > idx;
            const isActive = stepIndex === idx;

            return (
              <div key={s.id} className="flex items-center gap-3 text-xs">
                {isCompleted ? (
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[9px]">
                    ✓
                  </span>
                ) : isActive ? (
                  <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[9px] animate-pulse">
                    ●
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-[9px]">
                    ○
                  </span>
                )}
                <span className={`font-medium ${isActive ? "text-primary font-bold" : isCompleted ? "text-foreground" : "text-foreground-muted"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
